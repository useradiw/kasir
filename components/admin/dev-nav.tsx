"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MenuIcon } from "lucide-react";
import { useDevViewOptional } from "@/components/providers/dev-view-provider";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; ownerOnly?: boolean };
type NavGroup = { trigger: string; content: NavItem[] };

const VISIBLE_TRIGGERS = ["Navigasi", "Laporan"];

export function DevNav({ navItems }: { navItems: NavGroup[] }) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const pathname = usePathname();
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

  const visibleGroups = filteredItems.filter((g) =>
    VISIBLE_TRIGGERS.includes(g.trigger)
  );
  const sheetGroups = filteredItems.filter(
    (g) => !VISIBLE_TRIGGERS.includes(g.trigger)
  );

  if (!mounted) {
    // SSR placeholder — avoids base-ui useId() hydration mismatch
    return (
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="cursor-pointer">
          <MenuIcon className="size-4 text-gray-500" />
          <span className="sr-only">Menu navigasi</span>
        </Button>
        {visibleGroups.map((g) => (
          <span key={g.trigger} className="inline-flex h-9 items-center px-2.5 text-sm font-medium text-muted-foreground">
            {g.trigger}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {sheetGroups.length > 0 && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="cursor-pointer" />}
          >
            <MenuIcon className="size-4 text-gray-500" />
            <span className="sr-only">Menu navigasi</span>
          </SheetTrigger>
          <SheetContent>
            <nav className="flex flex-col py-2">
              {sheetGroups.map((group, i) => (
                <div key={group.trigger}>
                  {i > 0 && <div className="border-t border-border my-2 mx-4" />}
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.trigger}
                  </p>
                  {group.content.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center px-4 py-2.5 text-sm transition-colors min-h-11",
                        pathname === item.href
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      )}

      {visibleGroups.length > 0 && (
        <NavigationMenu className="max-w-full justify-start" align="start">
          <NavigationMenuList className="gap-0 justify-start flex-nowrap">
            {visibleGroups.map((group) => (
              <NavigationMenuItem key={group.trigger}>
                <NavigationMenuTrigger className="px-2.5">
                  {group.trigger}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="flex flex-col min-w-40">
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
            ))}
          </NavigationMenuList>
        </NavigationMenu>
      )}
    </div>
  );
}
