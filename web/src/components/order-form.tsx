// The form for a new order and for editing one. It checks the same rules as
// the server (the shared orderInput schema, plus stock and discontinued
// products from the catalog), so a mistake shows next to its field before
// anything is sent. The server checks everything again; if it still refuses,
// its message lands on the field it names.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { MAX_DISCOUNT, orderInput } from "api/schemas";
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingRows } from "@/components/query-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { api, ApiError, type Order, type OrderInput, type Product } from "@/lib/api";
import { formatCount, formatMoney } from "@/lib/format";
import { allCustomersQuery, allProductsQuery, refetchAfterWrite, shippersQuery } from "@/lib/queries";

interface OrderFormProps {
  /** The order being edited; without it, the form enters a new order. */
  order?: Order;
}

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Ties a control to the message under it, so a screen reader reads both. */
const errorId = (id: string) => `${id}-error`;
const describedBy = (id: string, invalid: boolean) => (invalid ? errorId(id) : undefined);

/** The shared rules, plus the ones that need the catalog. */
function formSchema(products: Map<number, Product>, held: Map<number, number>) {
  return orderInput.superRefine((input, ctx) => {
    if (input.required_date <= today()) {
      ctx.addIssue({
        code: "custom",
        path: ["required_date"],
        message: "The required date must be after today",
      });
    }
    input.lines.forEach((line, i) => {
      const product = products.get(line.product_id);
      if (!product) return;
      if (product.discontinued) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", i, "product_id"],
          message: `${product.name} is discontinued`,
        });
      }
      const available = product.units_in_stock + (held.get(line.product_id) ?? 0);
      if (line.quantity > available) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", i, "quantity"],
          message: `Only ${formatCount(available)} in stock`,
        });
      }
    });
  });
}

export function OrderForm({ order }: OrderFormProps) {
  const products = useQuery(allProductsQuery());
  const customers = useQuery(allCustomersQuery());
  const shippers = useQuery(shippersQuery());

  if (products.isError || customers.isError || shippers.isError) {
    const failed = [products, customers, shippers].filter((part) => part.isError);
    return (
      <ErrorState
        error={failed[0]?.error}
        what="The catalog"
        onRetry={() => failed.forEach((part) => void part.refetch())}
      />
    );
  }
  if (products.isPending || customers.isPending || shippers.isPending) {
    return <LoadingRows label="Loading the order form" rows={6} />;
  }
  return (
    <LoadedOrderForm
      order={order}
      products={products.data}
      customers={customers.data}
      shippers={shippers.data}
    />
  );
}

function LoadedOrderForm({
  order,
  products,
  customers,
  shippers,
}: OrderFormProps & {
  products: Product[];
  customers: { customer_id: string; company_name: string }[];
  shippers: { shipper_id: number; name: string }[];
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const byId = new Map(products.map((p) => [p.product_id, p]));
  // Stock this order already holds is free for it to use again when edited.
  const held = new Map((order?.lines ?? []).map((l) => [l.product_id, l.quantity]));

  const form = useForm<OrderInput>({
    resolver: zodResolver(formSchema(byId, held)),
    defaultValues: order
      ? {
          customer_id: order.customer_id,
          shipper_id: order.shipper_id,
          required_date: order.required_date.slice(0, 10),
          freight: order.freight_dollars,
          lines: order.lines.map((l) => ({
            product_id: l.product_id,
            quantity: l.quantity,
            discount: l.discount_fraction,
          })),
        }
      : {
          customer_id: "",
          shipper_id: shippers[0]?.shipper_id ?? 0,
          required_date: inDays(14),
          freight: 0,
          lines: [{ product_id: 0, quantity: 1, discount: 0 }],
        },
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const watched = useWatch({ control: form.control, name: "lines" });

  const save = useMutation({
    mutationFn: (input: OrderInput) => (order ? api.editOrder(order.order_id, input) : api.placeOrder(input)),
    onSuccess: async (saved) => {
      await refetchAfterWrite(queryClient);
      toast.success(order ? `Order ${saved.order_id} saved` : `Order ${saved.order_id} placed`);
      await navigate({ to: "/orders/$orderId", params: { orderId: String(saved.order_id) } });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.issues.length > 0) {
        error.issues.forEach((issue, i) => {
          // The server names fields the same way the form does, as in "lines.0.quantity".
          form.setError(
            issue.path as FieldPath<OrderInput>,
            { message: issue.message },
            { shouldFocus: i === 0 },
          );
        });
      } else {
        form.setError("root", { message: error.message });
      }
    },
  });

  const lineTotal = (i: number) => {
    const line = watched?.[i];
    const product = line ? byId.get(Number(line.product_id)) : undefined;
    if (!line || !product) return 0;
    return Math.round(product.unit_price_dollars * line.quantity * (1 - line.discount) * 100) / 100;
  };
  const estimate = (watched ?? []).reduce((sum, _, i) => sum + lineTotal(i), 0);

  return (
    <form onSubmit={form.handleSubmit((input) => save.mutate(input))} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Customer and delivery</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="customer_id"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="sm:col-span-2">
                <FieldLabel htmlFor="order-customer">Customer</FieldLabel>
                <NativeSelect
                  {...field}
                  id="order-customer"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={describedBy("order-customer", fieldState.invalid)}
                >
                  <NativeSelectOption value="">Choose a customer</NativeSelectOption>
                  {customers.map((c) => (
                    <NativeSelectOption key={c.customer_id} value={c.customer_id}>
                      {c.company_name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError id={errorId("order-customer")} errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="shipper_id"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="order-shipper">Shipper</FieldLabel>
                <NativeSelect
                  ref={field.ref}
                  id="order-shipper"
                  value={String(field.value)}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={describedBy("order-shipper", fieldState.invalid)}
                >
                  {shippers.map((s) => (
                    <NativeSelectOption key={s.shipper_id} value={String(s.shipper_id)}>
                      {s.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError id={errorId("order-shipper")} errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="required_date"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="order-required">Required by</FieldLabel>
                <Input
                  {...field}
                  id="order-required"
                  type="date"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={describedBy("order-required", fieldState.invalid)}
                />
                <FieldError id={errorId("order-required")} errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="freight"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="order-freight">Freight, in dollars</FieldLabel>
                <Input
                  ref={field.ref}
                  id="order-freight"
                  type="number"
                  min={0}
                  step="0.01"
                  value={Number.isNaN(field.value) ? "" : field.value}
                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={describedBy("order-freight", fieldState.invalid)}
                />
                <FieldError id={errorId("order-freight")} errors={[fieldState.error]} />
              </Field>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Products</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="@container/order-lines space-y-4">
          {lines.fields.map((line, i) => {
            const product = byId.get(Number(watched?.[i]?.product_id));
            const available = product
              ? product.units_in_stock + (held.get(product.product_id) ?? 0)
              : undefined;
            return (
              <fieldset
                key={line.id}
                className="grid items-start gap-3 border-b pb-4 @2xl/order-lines:grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_auto]"
              >
                <legend className="sr-only">Line {i + 1}</legend>
                <Controller
                  name={`lines.${i}.product_id`}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`line-${i}-product`}>Product</FieldLabel>
                      <NativeSelect
                        ref={field.ref}
                        id={`line-${i}-product`}
                        value={String(field.value)}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                        onBlur={field.onBlur}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={describedBy(`line-${i}-product`, fieldState.invalid)}
                      >
                        <NativeSelectOption value="0">Choose a product</NativeSelectOption>
                        {products.map((p) => (
                          <NativeSelectOption
                            key={p.product_id}
                            value={String(p.product_id)}
                            disabled={p.discontinued}
                          >
                            {p.name}
                            {p.discontinued ? " (discontinued)" : ""}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      {product ? (
                        <p className="text-muted-foreground text-xs">
                          {formatMoney(product.unit_price_dollars)} each, {formatCount(available ?? 0)} in
                          stock
                        </p>
                      ) : null}
                      <FieldError id={errorId(`line-${i}-product`)} errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  name={`lines.${i}.quantity`}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`line-${i}-quantity`}>Quantity</FieldLabel>
                      <Input
                        ref={field.ref}
                        id={`line-${i}-quantity`}
                        type="number"
                        min={1}
                        step={1}
                        value={Number.isNaN(field.value) ? "" : field.value}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        onBlur={field.onBlur}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={describedBy(`line-${i}-quantity`, fieldState.invalid)}
                      />
                      <FieldError id={errorId(`line-${i}-quantity`)} errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  name={`lines.${i}.discount`}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`line-${i}-discount`}>Discount, %</FieldLabel>
                      {/* The API takes a fraction (0.1); people type a percent (10). */}
                      <Input
                        ref={field.ref}
                        id={`line-${i}-discount`}
                        type="number"
                        min={0}
                        max={MAX_DISCOUNT * 100}
                        step={1}
                        value={Number.isNaN(field.value) ? "" : Math.round(field.value * 1000) / 10}
                        onChange={(event) => field.onChange(event.target.valueAsNumber / 100)}
                        onBlur={field.onBlur}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={describedBy(`line-${i}-discount`, fieldState.invalid)}
                      />
                      <FieldError id={errorId(`line-${i}-discount`)} errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <div className="grid gap-2">
                  <span className="text-sm font-medium">Line total</span>
                  <span className="py-1.5 tabular-nums">{formatMoney(lineTotal(i))}</span>
                </div>
                <div className="@2xl/order-lines:pt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove line ${i + 1}`}
                    disabled={lines.fields.length === 1}
                    onClick={() => lines.remove(i)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </fieldset>
            );
          })}
          <FieldError
            errors={[
              { message: form.formState.errors.lines?.message },
              { message: form.formState.errors.lines?.root?.message },
            ]}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => lines.append({ product_id: 0, quantity: 1, discount: 0 })}
          >
            <Plus aria-hidden="true" />
            Add a product
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p>
          <span className="text-muted-foreground text-sm">Lines total </span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(estimate)}</span>
        </p>
        <Button type="submit" size="lg" disabled={save.isPending}>
          {order ? "Save changes" : "Place order"}
        </Button>
      </div>
      {form.formState.errors.root ? (
        <p role="alert" className="text-destructive text-sm">
          {form.formState.errors.root.message}
        </p>
      ) : null}
    </form>
  );
}
