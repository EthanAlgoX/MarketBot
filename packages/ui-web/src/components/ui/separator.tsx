// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "@marketbot/ui-web/lib/utils";

function Separator({ className, orientation = "horizontal", ...props }: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
