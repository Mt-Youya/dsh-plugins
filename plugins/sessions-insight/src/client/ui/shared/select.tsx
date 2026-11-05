// shadcn/ui Select (Base UI): use the plugin's tokens and portal scope.
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "cn"
import type { ComponentProps } from "react"
import { useState } from "react"

const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" className={cn("p-1", className)} {...props} />
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value data-slot="select-value" className={cn("flex flex-1 text-start", className)} {...props} />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & { size?: "sm" | "default" }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex min-w-40 items-center justify-between gap-3 rounded-md border border-line bg-bg-1 py-2 ps-3 pe-2 text-[12px] whitespace-nowrap text-fg shadow-sm select-none hover:bg-hover active:bg-bg-3 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <span className="flex shrink-0 text-fg-dim">
            <HugeiconsIcon icon={ChevronDownIcon} className="size-4" />
          </span>
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  container,
  side = "bottom",
  sideOffset = 5,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"> &
  Pick<SelectPrimitive.Portal.Props, "container">) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)
  return (
    <div ref={setPortalContainer} className="contents">
      <SelectPrimitive.Portal container={container ?? portalContainer}>
        <SelectPrimitive.Positioner
          side={side}
          sideOffset={sideOffset}
          align={align}
          alignOffset={alignOffset}
          alignItemWithTrigger={alignItemWithTrigger}
          className="isolate z-50"
        >
          <SelectPrimitive.Popup
            data-slot="select-content"
            className={cn(
              "relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-40 overflow-x-clip overflow-y-auto rounded-lg border border-line bg-bg-1 p-1 text-[12px] text-fg shadow-xl",
              className,
            )}
            {...props}
          >
            <SelectScrollUpButton />
            <SelectPrimitive.List>{children}</SelectPrimitive.List>
            <SelectScrollDownButton />
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </div>
  )
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 py-1 text-[11px] text-fg-dim", className)}
      {...props}
    />
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-8 w-full cursor-default items-center gap-1.5 rounded-md py-1.5 ps-2 pe-8 text-[12px] text-fg select-none active:bg-bg-3 data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-bg-3",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute inset-e-2 flex size-4 items-center justify-center text-accent">
            <HugeiconsIcon icon={CheckIcon} className="size-4" />
          </span>
        }
      />
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("my-1 h-px bg-line-soft", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({ className, ...props }: ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn("flex w-full items-center justify-center bg-bg-1 py-1 text-fg-dim", className)}
      {...props}
    >
      <HugeiconsIcon icon={ChevronUpIcon} className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({ className, ...props }: ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn("flex w-full items-center justify-center bg-bg-1 py-1 text-fg-dim", className)}
      {...props}
    >
      <HugeiconsIcon icon={ChevronDownIcon} className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
