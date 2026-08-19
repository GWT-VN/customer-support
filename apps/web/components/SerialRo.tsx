/**
 * Hiển thị serial phân biệt RÕ các ký tự dễ nhầm — `l` (L thường) vs `I` (i HOA),
 * `0` (số không) vs `O` (chữ O), `1` (số một). Tô màu + tooltip từng ký tự để
 * người nhập/soát đối chiếu được với chứng từ giấy, tránh sai serial khi nhập kho.
 */
const NHAN: Record<string, string> = {
  l: 'chữ L thường',
  I: 'chữ i HOA',
  '1': 'số một',
  O: 'chữ O',
  '0': 'số không',
}

export function SerialRo({ serial, className = '' }: { serial: string; className?: string }) {
  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {[...serial].map((c, i) =>
        NHAN[c] ? (
          <span
            key={i}
            title={NHAN[c]}
            className="text-amber-700 bg-amber-50 rounded-[2px] underline decoration-dotted underline-offset-2"
          >
            {c}
          </span>
        ) : (
          <span key={i}>{c}</span>
        )
      )}
    </span>
  )
}
