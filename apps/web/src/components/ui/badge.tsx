import { cn } from '@/lib/utils'
import { type VariantProps, cva } from 'class-variance-authority'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border',
  {
    variants: {
      variant: {
        default:      'bg-gray-100 text-gray-700 border-gray-200',
        brand:        'bg-brand-50 text-brand-700 border-brand-200',
        success:      'bg-green-50 text-green-700 border-green-200',
        warning:      'bg-amber-50 text-amber-700 border-amber-200',
        danger:       'bg-red-50 text-red-700 border-red-200',
        info:         'bg-blue-50 text-blue-700 border-blue-200',
        compatible:   'bg-brand-50 text-brand-700 border-brand-200',
        incompatible: 'bg-red-50 text-red-600 border-red-200',
        unknown:      'bg-gray-50 text-gray-500 border-gray-200',
        open:         'bg-brand-500 text-white border-brand-500',
        closing:      'bg-amber-500 text-white border-amber-500',
        closed:       'bg-gray-400 text-white border-gray-400',
        canceled:     'bg-red-500 text-white border-red-500',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
