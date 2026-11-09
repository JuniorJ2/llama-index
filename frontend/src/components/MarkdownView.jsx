import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// Texto plano de un nodo hast (para medir longitud de ítems)
const textOf = (node) => {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  return (node.children || []).map(textOf).join('');
};

const isBlankText = (c) => c.type === 'text' && !(c.value || '').trim();

// Una lista es "de tarjetas" cuando todos sus ítems son "**Etiqueta:** dato" cortos
const isCardList = (node) => {
  if (!node) return false;
  const lis = (node.children || []).filter((c) => c.type === 'element' && c.tagName === 'li');
  if (lis.length < 2 || lis.length > 16) return false;
  return lis.every((li) => {
    const kids = (li.children || []).filter((c) => !isBlankText(c));
    if (!kids.length) return false;
    const first = kids[0];
    if (first.type !== 'element' || first.tagName !== 'strong') return false;
    const hasBlock = kids.some(
      (c) => c.type === 'element' && ['ul', 'ol', 'p', 'table'].includes(c.tagName)
    );
    if (hasBlock) return false;
    return textOf(li).length <= 110;
  });
};

const flattenText = (children) =>
  React.Children.toArray(children)
    .map((c) => (typeof c === 'string' ? c : flattenText(c?.props?.children)))
    .join('');

function InfoCard({ children }) {
  const kids = React.Children.toArray(children);
  const idx = kids.findIndex((k) => React.isValidElement(k) && k.type === 'strong');
  if (idx === -1) return <div className="md-card">{kids}</div>;

  const label = flattenText(kids[idx].props.children).replace(/[\s:：]+$/, '');
  const rest = kids.slice(idx + 1);
  if (typeof rest[0] === 'string') rest[0] = rest[0].replace(/^[\s:：]+/, '');

  return (
    <div className="md-card">
      <span className="md-card-label">{label}</span>
      <span className="md-card-value">{rest.length ? rest : '—'}</span>
    </div>
  );
}

// Definido fuera del componente para que no se recree en cada render
const components = {
  ul: ({ node, children }) => {
    if (isCardList(node)) {
      const items = React.Children.toArray(children).filter(React.isValidElement);
      return (
        <div className="md-cards">
          {items.map((li, i) => (
            <InfoCard key={i}>{li.props.children}</InfoCard>
          ))}
        </div>
      );
    }
    return <ul>{children}</ul>;
  },
  table: ({ children }) => (
    <div className="md-table-wrap">
      <table>{children}</table>
    </div>
  ),
};

export default function MarkdownView({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
