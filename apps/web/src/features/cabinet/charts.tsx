import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatIsoDay, formatPrice } from '@/lib/format';

const tooltipStyle = {
  background: 'var(--glass-strong)',
  border: '1px solid var(--glass-border)',
  borderRadius: 14,
  boxShadow: 'var(--glass-shadow)',
  backdropFilter: 'blur(16px)',
  fontSize: 13,
  color: 'var(--foreground)',
};

export function RevenueChart({
  data,
  currency,
  height = 170,
}: {
  data: { date: string; amount: number }[];
  currency: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickFormatter={(d: string) => d.slice(8)}
          interval="preserveStartEnd"
          minTickGap={18}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(d) => formatIsoDay(String(d), 'd MMMM')}
          formatter={(v) => [formatPrice(Number(v), currency), '']}
          separator=""
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          fill="url(#rev)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function WeekdayBars({
  data,
  height = 150,
}: {
  data: { dayOfWeek: number; count: number }[];
  height?: number;
}) {
  const { t } = useTranslation();
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data.map((d) => ({
          ...d,
          label: t(`common.weekdaysShort.${String(d.dayOfWeek) as '1'}`),
        }))}
        margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
      >
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
        />
        <YAxis hide domain={[0, max]} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--muted)' }}
          formatter={(v) => [String(v), '']}
          separator=""
        />
        <Bar dataKey="count" radius={[10, 10, 10, 10]}>
          {data.map((d) => (
            <Cell
              key={d.dayOfWeek}
              fill={d.count === max ? 'var(--chart-1)' : 'var(--chart-2)'}
              fillOpacity={d.count === max ? 1 : 0.55}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HourBars({
  data,
  height = 150,
}: {
  data: { hour: number; count: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--muted)' }}
          labelFormatter={(h) => `${h}:00`}
          formatter={(v) => [String(v), '']}
          separator=""
        />
        <Bar dataKey="count" radius={[8, 8, 8, 8]} fill="var(--chart-2)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-4)', 'var(--chart-3)'];

export function GenderPie({ data }: { data: { gender: string; count: number }[] }) {
  const { t } = useTranslation();
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return null;
  return (
    <div className="flex items-center gap-4">
      <div className="size-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="gender"
              innerRadius={30}
              outerRadius={52}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={d.gender} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-1.5 text-[14px]">
        {data.map((d, i) => (
          <li key={d.gender} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            {t(`enums.gender.${d.gender as 'MALE'}`)} · {Math.round((d.count / total) * 100)}%
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AgeBars({
  data,
  height = 130,
}: {
  data: { bucket: string; count: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--muted)' }}
          formatter={(v) => [String(v), '']}
          separator=""
        />
        <Bar dataKey="count" radius={[8, 8, 8, 8]} fill="var(--chart-4)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
