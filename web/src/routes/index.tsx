import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { z } from "zod";
import { DateRange } from "@/components/dashboard-range";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/query-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dashboard } from "@/lib/api";
import { formatCount, formatMoney } from "@/lib/format";
import { formatMonth, formatMonthTick } from "@/lib/months";
import { dashboardQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .optional()
  .catch(undefined);

export const Route = createFileRoute("/")({
  validateSearch: z.object({ from: month, to: month }),
  component: DashboardPage,
});

const chartConfig = { revenue_dollars: { label: "Revenue", color: "var(--chart-1)" } } satisfies ChartConfig;
const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function DashboardPage() {
  const { from, to } = Route.useSearch();
  const navigate = Route.useNavigate();
  const dashboard = useQuery(dashboardQuery({ from, to }));

  return (
    <>
      <PageHeader
        title="Sales dashboard"
        description={
          dashboard.data
            ? `${formatMonth(dashboard.data.from)} to ${formatMonth(dashboard.data.to)}`
            : "Revenue from every order, by month, product, employee and country"
        }
      />
      <DateRange from={from} to={to} onChange={(range) => void navigate({ search: range })} />

      {dashboard.isPending ? (
        <div role="status" aria-label="Loading the dashboard" className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
          <Skeleton className="h-80 md:col-span-3" />
        </div>
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} what="The dashboard" onRetry={() => void dashboard.refetch()} />
      ) : (
        <DashboardBody data={dashboard.data} stale={dashboard.isPlaceholderData} />
      )}
    </>
  );
}

function DashboardBody({ data, stale }: { data: Dashboard; stale: boolean }) {
  const { totals } = data;
  const average = totals.order_count ? totals.revenue_dollars / totals.order_count : 0;

  return (
    <div className={cn("space-y-6 transition-opacity", stale && "opacity-60")} aria-busy={stale}>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Revenue" value={formatMoney(totals.revenue_dollars)} />
        <Stat label="Orders" value={formatCount(totals.order_count)} />
        <Stat label="Average order" value={formatMoney(average)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by month</CardTitle>
          <CardDescription>Line totals of the orders placed each month, before freight</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
            <BarChart data={data.revenue_by_month} margin={{ left: 8, right: 8 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
                tickFormatter={formatMonthTick}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(value: number) => compactMoney.format(value)}
              />
              <ChartTooltip
                cursor={{ fillOpacity: 0.1 }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => formatMonth(String(payload[0]?.payload?.month ?? ""))}
                    formatter={(value, _name, item) => (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">
                          {formatCount(Number(item.payload.order_count))} orders
                        </span>
                        <span className="font-medium tabular-nums">{formatMoney(Number(value))}</span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="revenue_dollars" fill="var(--color-revenue_dollars)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
          <details className="mt-4 text-sm">
            <summary className="text-muted-foreground cursor-pointer">Show the figures as a table</summary>
            <table className="mt-2 w-full max-w-md">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="py-1 font-medium">Month</th>
                  <th className="py-1 text-right font-medium">Orders</th>
                  <th className="py-1 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.revenue_by_month.map((m) => (
                  <tr key={m.month} className="border-t">
                    <td className="py-1">{formatMonth(m.month)}</td>
                    <td className="py-1 text-right tabular-nums">{formatCount(m.order_count)}</td>
                    <td className="py-1 text-right tabular-nums">{formatMoney(m.revenue_dollars)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Ranking
          title="Top products"
          rows={data.top_products.map((p) => ({
            key: String(p.product_id),
            label: (
              <Link
                to="/products/$productId"
                params={{ productId: String(p.product_id) }}
                className="hover:underline"
              >
                {p.name}
              </Link>
            ),
            detail: `${formatCount(p.quantity)} units`,
            value: p.revenue_dollars,
          }))}
        />
        <Ranking
          title="Sales by employee"
          rows={data.by_employee.map((e) => ({
            key: String(e.employee_id),
            label: (
              <Link
                to="/employees/$employeeId"
                params={{ employeeId: String(e.employee_id) }}
                className="hover:underline"
              >
                {e.name}
              </Link>
            ),
            detail: `${formatCount(e.order_count)} orders`,
            value: e.revenue_dollars,
          }))}
        />
        <Ranking
          title="Sales by country"
          rows={data.by_country.slice(0, 10).map((c) => ({
            key: c.country,
            label: c.country,
            detail: `${formatCount(c.order_count)} orders`,
            value: c.revenue_dollars,
          }))}
          note={data.by_country.length > 10 ? `The top 10 of ${data.by_country.length} countries` : undefined}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

interface RankingRow {
  key: string;
  label: ReactNode;
  detail: string;
  value: number;
}

/** A ranked list with each value as a bar, scaled to the largest, and as a number. */
function Ranking({ title, rows, note }: { title: string; rows: RankingRow[]; note?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {note ? <CardDescription>{note}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No orders in this range.</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">{title}, by revenue</caption>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="align-top">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-muted-foreground block text-xs">{row.detail}</span>
                    <span className="bg-muted mt-1 block h-1.5 rounded-full" aria-hidden="true">
                      <span
                        className="block h-full rounded-full bg-[var(--chart-1)]"
                        style={{ width: `${max ? (row.value / max) * 100 : 0}%` }}
                      />
                    </span>
                  </th>
                  <td className="py-1.5 text-right font-medium whitespace-nowrap tabular-nums">
                    {formatMoney(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
