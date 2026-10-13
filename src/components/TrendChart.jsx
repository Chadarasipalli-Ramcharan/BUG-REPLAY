"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function TrendChart({ data }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="errFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4d8dff" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#4d8dff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1e2a3a" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(d) => String(d).slice(5)}
            stroke="#5d6b84"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            stroke="#5d6b84"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: "#26344a" }}
            contentStyle={{
              background: "#151d29",
              border: "1px solid #1e2a3a",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#8c99af" }}
            itemStyle={{ color: "#e8edf6" }}
          />
          <Area
            type="monotone"
            dataKey="errors"
            name="errors"
            stroke="#4d8dff"
            strokeWidth={2}
            fill="url(#errFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
