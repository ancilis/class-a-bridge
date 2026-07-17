import type { FaqItem } from "../content/types";

interface FaqListProps {
  readonly items: readonly FaqItem[];
}

export function FaqList({ items }: FaqListProps) {
  return (
    <div className="faq-list">
      {items.map((item) => (
        <details key={item.question} className="faq-item">
          <summary>{item.question}</summary>
          <div>
            <p>{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
