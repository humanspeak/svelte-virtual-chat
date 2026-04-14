import { SiGithub, SiNpm } from '@icons-pack/svelte-simple-icons'
import {
    ArrowDown,
    ArrowRight,
    BookOpen,
    Box,
    Check,
    ChevronDown,
    ChevronRight,
    Code,
    Copy,
    ExternalLink,
    Gauge,
    Grid2x2,
    History,
    MessageSquare,
    Play,
    Rocket,
    RotateCw,
    ScrollText,
    Settings,
    Zap
} from '@lucide/svelte'

export const iconMap = {
    'arrow-down': ArrowDown,
    'arrow-right': ArrowRight,
    'book-open': BookOpen,
    box: Box,
    check: Check,
    'chevron-down': ChevronDown,
    'chevron-right': ChevronRight,
    code: Code,
    copy: Copy,
    'external-link': ExternalLink,
    gauge: Gauge,
    'grid-2x2': Grid2x2,
    history: History,
    'message-square': MessageSquare,
    play: Play,
    rocket: Rocket,
    'rotate-cw': RotateCw,
    'scroll-text': ScrollText,
    settings: Settings,
    zap: Zap,
    github: SiGithub,
    npm: SiNpm
} as const

export type IconName = keyof typeof iconMap
