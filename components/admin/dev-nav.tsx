"use client";

import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { useDevViewOptional } from "@/components/providers/dev-view-provider";

type NavItem = { href: string; label: string; ownerOnly?: boolean };
type NavGroup = { trigger: string; content: NavItem[] };

export function DevNav({ navItems }: { navItems: NavGroup[] }) {
  // Read dev view context; null if outside provider (unauthenticated routes, etc.)
  const ctx = useDevViewOptional();
  const viewAsRole = ctx?.viewAsRole ?? null;

  // When viewing as a non-OWNER role, hide ownerOnly items
  const effectiveIsOwner = viewAsRole === null || viewAsRole === "OWNER";

  const filteredItems = navItems
    .map((group) => ({
      ...group,
      content: group.content.filter(
        (item) => effectiveIsOwner || !item.ownerOnly
      ),
    }))
    .filter((group) => group.content.length > 0);

  return (
    <NavigationMenu className="mt-2" align="start">
      <NavigationMenuList className="gap-0 justify-start">
        {filteredItems.map((item) => (
          <NavigationMenuItem key={item.trigger}>
            <NavigationMenuTrigger className="text-xs sm:text-sm px-2.5 sm:px-4">
              {item.trigger}
            </NavigationMenuTrigger>
            {item.content.map((subItem) => (
              <NavigationMenuContent key={subItem.label}>
                <NavigationMenuLink
                  render={<Link href={subItem.href} className="cursor-pointer" />}
                  className={navigationMenuTriggerStyle()}
                >
                  {subItem.label}
                </NavigationMenuLink>
              </NavigationMenuContent>
            ))}
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
