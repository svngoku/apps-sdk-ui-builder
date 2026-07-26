/**
 * Component map
 * -------------
 * Maps registry names to the real React components, so the canvas renders the
 * genuine Apps SDK UI library rather than an approximation. Preview fidelity is
 * then exact by construction — what you see on the canvas *is* the component the
 * exported code imports.
 *
 * Static imports (rather than a dynamic `import()` per component) keep the whole
 * palette synchronously available, which the renderer relies on.
 */

import type { ComponentType } from "react"

import { Alert } from "@openai/apps-sdk-ui/components/Alert"
import { Avatar, AvatarGroup } from "@openai/apps-sdk-ui/components/Avatar"
import { Badge } from "@openai/apps-sdk-ui/components/Badge"
import { Button, ButtonLink, CopyButton } from "@openai/apps-sdk-ui/components/Button"
import { Checkbox } from "@openai/apps-sdk-ui/components/Checkbox"
import { CodeBlock } from "@openai/apps-sdk-ui/components/CodeBlock"
import { DatePicker } from "@openai/apps-sdk-ui/components/DatePicker"
import { DateRangePicker } from "@openai/apps-sdk-ui/components/DateRangePicker"
import { EmptyMessage } from "@openai/apps-sdk-ui/components/EmptyMessage"
import * as Icons from "@openai/apps-sdk-ui/components/Icon"
import { Image } from "@openai/apps-sdk-ui/components/Image"
import {
  CircularProgress,
  LoadingDots,
  LoadingIndicator,
} from "@openai/apps-sdk-ui/components/Indicator"
import { Input } from "@openai/apps-sdk-ui/components/Input"
import { Markdown } from "@openai/apps-sdk-ui/components/Markdown"
import { Menu } from "@openai/apps-sdk-ui/components/Menu"
import { Popover } from "@openai/apps-sdk-ui/components/Popover"
import { RadioGroup } from "@openai/apps-sdk-ui/components/RadioGroup"
import { SegmentedControl } from "@openai/apps-sdk-ui/components/SegmentedControl"
import { Select } from "@openai/apps-sdk-ui/components/Select"
import { SelectControl } from "@openai/apps-sdk-ui/components/SelectControl"
import { ShimmerText } from "@openai/apps-sdk-ui/components/ShimmerText"
import { Slider } from "@openai/apps-sdk-ui/components/Slider"
import { Switch } from "@openai/apps-sdk-ui/components/Switch"
import { TagInput } from "@openai/apps-sdk-ui/components/TagInput"
import { Textarea } from "@openai/apps-sdk-ui/components/Textarea"
import { TextLink } from "@openai/apps-sdk-ui/components/TextLink"
import { Tooltip } from "@openai/apps-sdk-ui/components/Tooltip"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>

/**
 * Registry name -> component. Compound parts are registered under their dotted
 * name so the renderer can resolve `Menu.Item` with a single lookup.
 */
export const COMPONENTS: Record<string, AnyComponent> = {
  Alert,
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  ButtonLink,
  Checkbox,
  CircularProgress,
  CodeBlock,
  CopyButton,
  DatePicker,
  DateRangePicker,
  EmptyMessage,
  "EmptyMessage.ActionRow": EmptyMessage.ActionRow,
  "EmptyMessage.Description": EmptyMessage.Description,
  "EmptyMessage.Icon": EmptyMessage.Icon,
  "EmptyMessage.Title": EmptyMessage.Title,
  Image,
  Input,
  LoadingDots,
  LoadingIndicator,
  Markdown,
  Menu,
  "Menu.CheckboxItem": Menu.CheckboxItem,
  "Menu.Content": Menu.Content,
  "Menu.Item": Menu.Item,
  "Menu.ItemAction": Menu.ItemAction,
  "Menu.ItemActions": Menu.ItemActions,
  "Menu.Link": Menu.Link as AnyComponent,
  "Menu.RadioGroup": Menu.RadioGroup as AnyComponent,
  "Menu.RadioItem": Menu.RadioItem as AnyComponent,
  "Menu.Separator": Menu.Separator,
  "Menu.Sub": Menu.Sub,
  "Menu.SubContent": Menu.SubContent,
  "Menu.SubTrigger": Menu.SubTrigger,
  "Menu.Trigger": Menu.Trigger,
  Popover,
  "Popover.Content": Popover.Content,
  "Popover.Trigger": Popover.Trigger,
  RadioGroup,
  "RadioGroup.Item": RadioGroup.Item as AnyComponent,
  SegmentedControl,
  "SegmentedControl.Option": SegmentedControl.Option as AnyComponent,
  Select,
  SelectControl,
  ShimmerText,
  Slider,
  Switch,
  TagInput,
  TextLink,
  Textarea,
  Tooltip: Tooltip.Root,
  "Tooltip.Content": Tooltip.Content,
  "Tooltip.Root": Tooltip.Root,
  "Tooltip.Trigger": Tooltip.Trigger,
  "Tooltip.TriggerDecorator": Tooltip.TriggerDecorator,
}

/** All 745 icon components, keyed by export name. */
export const ICONS = Icons as unknown as Record<string, AnyComponent>

export function getComponent(name: string): AnyComponent | undefined {
  return COMPONENTS[name]
}

export function getIcon(name: string): AnyComponent | undefined {
  return ICONS[name]
}
