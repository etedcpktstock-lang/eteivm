import React from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

type SparklineProps = {
  data: { value: number }[];
  color: string;
};

export const DashboardSparkline: React.FC<SparklineProps> = ({ data, color }) => {
  const gradId = `gradient-${(color || '#ccc').replace('#', '')}`;
  return (
    <div style={{ width: '100%', height: 32 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color || '#ccc'} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color || '#ccc'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color || '#ccc'}
            strokeWidth={1.5}
            fillOpacity={1}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
