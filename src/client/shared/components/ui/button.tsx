import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/client/shared/components/ui/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-lg border border-transparent bg-clip-padding font-medium text-sm outline-none transition-all focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/30 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-45",
        outline:
          "border-border bg-input/30 hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        destructive:
          "bg-destructive-soft text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/30",
        link: "text-brand-text underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 pointer-fine:h-8 gap-1.5 pointer-fine:px-2.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-11 pointer-fine:h-6 min-w-11 pointer-fine:min-w-0 gap-1 in-data-[slot=button-group]:rounded-lg rounded-md px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-11 pointer-fine:h-7 gap-1 in-data-[slot=button-group]:rounded-lg rounded-md pointer-fine:px-2.5 px-3 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 pointer-fine:h-9 gap-1.5 pointer-fine:px-2.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "pointer-fine:size-8 size-11",
        "icon-xs":
          "pointer-fine:size-6 size-11 in-data-[slot=button-group]:rounded-lg rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "pointer-fine:size-7 size-11 in-data-[slot=button-group]:rounded-lg rounded-md",
        "icon-lg": "pointer-fine:size-9 size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
