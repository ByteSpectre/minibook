import { randomInt } from 'node:crypto';
import {
  experimentVariantSchema,
  type ExperimentDto,
  type ExperimentVariant,
} from '@nail-crm/shared';
import { prisma } from '../../db/prisma';

/** Assigns a new master to the active experiment (one experiment per master). */
export async function assignExperiment(masterId: string): Promise<void> {
  const experiment = await prisma.experiment.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!experiment) return;
  const variant = randomInt(0, 100) < experiment.splitPercent ? 'B' : 'A';
  await prisma.masterExperiment.createMany({
    data: [{ experimentId: experiment.id, masterId, variant }],
    skipDuplicates: true,
  });
}

export async function getMasterVariant(
  masterId: string,
): Promise<{ experimentId: string; variant: 'A' | 'B'; config: ExperimentVariant } | null> {
  const assignment = await prisma.masterExperiment.findUnique({
    where: { masterId },
    include: { experiment: true },
  });
  if (!assignment || !assignment.experiment.isActive) return null;
  const variant = assignment.variant === 'B' ? 'B' : 'A';
  const raw = variant === 'B' ? assignment.experiment.variantB : assignment.experiment.variantA;
  const parsed = experimentVariantSchema.safeParse(raw);
  return {
    experimentId: assignment.experimentId,
    variant,
    config: parsed.success ? parsed.data : {},
  };
}

export async function experimentResults(experimentId: string): Promise<ExperimentDto['results']> {
  const assignments = await prisma.masterExperiment.findMany({
    where: { experimentId },
    select: {
      variant: true,
      master: {
        select: { payments: { where: { status: 'succeeded' }, select: { id: true }, take: 1 } },
      },
    },
  });
  return (['A', 'B'] as const).map((variant) => {
    const group = assignments.filter((a) => a.variant === variant);
    const paid = group.filter((a) => a.master.payments.length > 0).length;
    return {
      variant,
      assigned: group.length,
      paid,
      conversionPct: group.length ? Math.round((paid / group.length) * 1000) / 10 : 0,
    };
  });
}
