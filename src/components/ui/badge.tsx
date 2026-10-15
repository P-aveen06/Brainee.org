import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground [a]:hover:bg-deep-panel",
				secondary:
					"bg-surface-alt text-accent [a]:hover:bg-[#e9e9f6] dark:bg-surface-alt dark:text-accent",
				outline:
					"border-border text-foreground [a]:hover:bg-surface [a]:hover:text-foreground",
				ghost:
					"hover:bg-surface-alt hover:text-foreground dark:hover:bg-muted/50",
				destructive:
					"bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
				link: "text-accent underline-offset-4 hover:underline",
				chip: "border-border bg-surface text-body font-mono font-medium text-[11px] tracking-normal",
				ai: "bg-pale-pink text-ai-pink dark:bg-pale-pink/20 dark:text-ai-pink",
				accent:
					"bg-pale-purple text-accent dark:bg-pale-purple/20 dark:text-accent",
				gradient: "clickup-gradient-brand text-white shadow-xs",
				success:
					"bg-[#e9fbf0] text-[#1c7c4b] dark:bg-emerald-950/40 dark:text-emerald-400",
				warning:
					"bg-[#fff9e6] text-[#997300] dark:bg-amber-950/40 dark:text-amber-400",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant = "default",
	render,
	...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				className: cn(badgeVariants({ variant }), className),
			},
			props,
		),
		render,
		state: {
			slot: "badge",
			variant,
		},
	});
}

export { Badge, badgeVariants };
