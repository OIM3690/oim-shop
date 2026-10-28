import { Link, useMatchRoute } from "@tanstack/react-router";
import { Building2, Factory, Package, ReceiptText, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const sections = [
  { to: "/products", label: "Products", icon: Package },
  { to: "/customers", label: "Customers", icon: Building2 },
  { to: "/orders", label: "Orders", icon: ReceiptText },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/suppliers", label: "Suppliers", icon: Factory },
] as const;

export function AppSidebar() {
  const matchRoute = useMatchRoute();
  // On a phone the menu covers the page, so choosing a section closes it.
  const { setOpenMobile } = useSidebar();

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
                {sections.map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={Boolean(matchRoute({ to, fuzzy: true }))}>
                      <Link to={to} onClick={() => setOpenMobile(false)}>
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
