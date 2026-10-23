import { useQuery } from "@tanstack/react-query";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { Building2, ClipboardList, LayoutDashboard, Package, ReceiptText, Users } from "lucide-react";
import { Account } from "@/components/account";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { meQuery } from "@/lib/queries";

const sections = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/products", label: "Products", icon: Package, exact: false },
  { to: "/customers", label: "Customers", icon: Building2, exact: false },
  { to: "/orders", label: "Orders", icon: ReceiptText, exact: false },
  { to: "/employees", label: "Employees", icon: Users, exact: false },
] as const;

export function AppSidebar() {
  const matchRoute = useMatchRoute();
  // On a phone the menu covers the page, so choosing a section closes it.
  const { setOpenMobile } = useSidebar();
  const me = useQuery(meQuery());
  const isRep = Boolean(me.data?.employee);

  const item = (to: string, label: string, Icon: typeof Package, exact: boolean) => (
    <SidebarMenuItem key={to}>
      <SidebarMenuButton asChild isActive={Boolean(matchRoute({ to, fuzzy: !exact }))}>
        <Link to={to} onClick={() => setOpenMobile(false)}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <p className="text-base font-semibold tracking-tight">Northwind Traders</p>
        <p className="text-muted-foreground text-xs">Sales system</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label="Sections">
              <SidebarMenu>
                {sections.map(({ to, label, icon, exact }) => item(to, label, icon, exact))}
                {isRep ? item("/my-orders", "My orders", ClipboardList, false) : null}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Account />
      </SidebarFooter>
    </Sidebar>
  );
}
