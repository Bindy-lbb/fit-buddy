import type { Weight } from '../types'

const W = 320
const H = 120
const PAD = 8

/** 体重曲线。绝对数字只在允许看的时候才出现，图形本身不泄露基数 */
export function WeightChart({
  weights,
  targetWeight,
  showNumbers,
}: {
  weights: Weight[]
  targetWeight: number | null
  showNumbers: boolean
}) {
  if (weights.length < 2) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-rule">
        <p className="text-center text-xs leading-relaxed text-muted">
          记满两次体重就会出现曲线
          <br />
          建议固定早上空腹称，数字才有可比性
        </p>
      </div>
    )
  }

  const values = weights.map((w) => w.kg)
  const candidates = targetWeight ? [...values, targetWeight] : values
  const min = Math.min(...candidates)
  const max = Math.max(...candidates)
  const span = max - min || 1
  const x = (i: number) => PAD + (i / (weights.length - 1)) * (W - PAD * 2)
  const y = (kg: number) => PAD + (1 - (kg - min) / span) * (H - PAD * 2)

  const line = weights.map((w, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(w.kg).toFixed(1)}`).join(' ')
  const area = `${line} L${x(weights.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`
  const last = weights[weights.length - 1]
  const first = weights[0]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[120px] w-full" role="img" aria-label="体重曲线">
        {targetWeight != null && targetWeight >= min && targetWeight <= max && (
          <line
            x1={PAD}
            x2={W - PAD}
            y1={y(targetWeight)}
            y2={y(targetWeight)}
            stroke="currentColor"
            strokeDasharray="3 4"
            strokeWidth="1"
            className="text-muted"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path d={area} fill="currentColor" className="text-stamp" opacity="0.08" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-stamp"
          vectorEffect="non-scaling-stroke"
        />
        {weights.map((w, i) => (
          <circle
            key={w.id}
            cx={x(i)}
            cy={y(w.kg)}
            r={i === weights.length - 1 ? 3.5 : 2}
            fill="currentColor"
            className="text-stamp"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
        <span>{first.date.slice(5)}</span>
        <span>
          {showNumbers
            ? `${first.kg} → ${last.kg} kg`
            : `${weights.length} 次记录`}
        </span>
        <span>{last.date.slice(5)}</span>
      </div>
    </div>
  )
}
