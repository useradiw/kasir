"use client";

import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { useDevViewOptional } from "@/components/providers/dev-view-provider";

type NavItem = { href: string; label: string; ownerOnly?: boolean };
type NavGroup = { trigger: string; content: NavItem[] };

/** Groups that get merged into "Lainnya" on mobile (< md). */
const MOBILE_COLLAPSE_TRIGGERS = ["Keuangan", "Laporan", "Sistem"];

export function DevNav({ navItems }: { navItems: NavGroup[] }) {
  const ctx = useDevViewOptional();
  const viewAsRole = ctx?.viewAsRole ?? null;
  const effectiveIsOwner = viewAsRole === null || viewAsRole === "OWNER";

  const filteredItems = navItems
    .map((group) => ({
      ...group,
      content: group.content.filter(
        (item) => effectiveIsOwner || !item.ownerOnly
      ),
    }))
    .filter((group) => group.content.length > 0);

  // Desktop: show all groups as-is
  // Mobile: merge designated groups into "Lainnya"
  const mobileKeep = filteredItems.filter(
    (g) => !MOBILE_COLLAPSE_TRIGGERS.includes(g.trigger)
  );
  const mobileCollapsed = filteredItems.filter(
    (g) => MOBILE_COLLAPSE_TRIGGERS.includes(g.trigger)
  );

  return (
    <>
      {/* Desktop: all groups */}
      <NavigationMenu className="mt-2 hidden md:flex" align="start">
        <NavigationMenuList className="gap-0 justify-start">
          {filteredItems.map((item) => (
            <NavGroupItem key={item.trigger} group={item} />
          ))}
        </NavigationMenuList>
      </NavigationMenu>

      {/* Mobile: collapsed groups */}
      <NavigationMenu className="mt-2 md:hidden" align="start">
        <NavigationMenuList className="gap-0 justify-start">
          {mobileKeep.map((item) => (
            <NavGroupItem key={item.trigger} group={item} />
          ))}
          {mobileCollapsed.length > 0 && (
            <NavGroupItemGrouped trigger="Lainnya" groups={mobileCollapsed} />
          )}
        </NavigationMenuList>
      </NavigationMenu>
    </>
  );
}

/** Standard nav group with a single flat list of links. */
function NavGroupItem({ group }: { group: NavGroup }) {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className="text-xs sm:text-sm px-2.5 sm:px-4">
        {group.trigger}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <div className="flex flex-col min-w-[160px]">
          {group.content.map((subItem) => (
            <NavigationMenuLink
              key={subItem.label}
              render={<Link href={subItem.href} className="cursor-pointer" />}
            >
              {subItem.label}
            </NavigationMenuLink>
          ))}
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

/** "Lainnya" nav group: shows links organized by their original group with headers. */
function NavGroupItemGrouped({ trigger, groups }: { trigger: string; groups: NavGroup[] }) {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className="text-xs sm:text-sm px-2.5 sm:px-4">
        {trigger}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <div className="flex flex-col min-w-[180px]">
          {groups.map((group, i) => (
            <div key={group.trigger}>
              {i > 0 && <div className="border-t border-border my-1" />}
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.trigger}
              </p>
              {group.content.map((subItem) => (
                <NavigationMenuLink
                  key={subItem.label}
                  render={<Link href={subItem.href} className="cursor-pointer" />}
                >
                  {subItem.label}
                </NavigationMenuLink>
              ))}
            </div>
          ))}
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}
