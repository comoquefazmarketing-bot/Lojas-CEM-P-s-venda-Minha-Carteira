/* ------------------------------- comissão & categorias (estimativa) ------------------------------- */
// Taxas informadas: móveis 2,5% e TV 0,5%. Pra produtos que não se encaixam em nenhuma das
// duas categorias, usamos uma taxa intermediária aproximada (média das duas) só pra dar uma
// perspectiva — não é o valor oficial.
// Uma venda pode ter vários produtos (campo Produto aceita múltiplos itens); como só existe um
// valor_total por venda, dividimos ele igualmente entre os itens e aplicamos a taxa de cada
// categoria separadamente — assim uma venda "Sofá + Smart TV" não cai inteira em Móveis.
export type CategoriaProduto = 'MOVEIS' | 'TV' | 'OUTROS';

export const CATEGORIA_LABELS: Record<CategoriaProduto, string> = { MOVEIS: 'Móveis', TV: 'TV', OUTROS: 'Outros produtos' };
export const CATEGORIA_TAXA: Record<CategoriaProduto, number> = { MOVEIS: 0.025, TV: 0.005, OUTROS: 0.015 };
export const CATEGORIA_ORDEM: CategoriaProduto[] = ['MOVEIS', 'TV', 'OUTROS'];
const CATEGORIA_PALAVRAS: { categoria: CategoriaProduto; palavras: string[] }[] = [
  { categoria: 'MOVEIS', palavras: ['sofa', 'cama', 'colchao', 'guarda-roupa', 'guarda roupa', 'guardaroupa', 'estante', 'mesa', 'cadeira', 'rack', 'armario', 'painel', 'poltrona', 'comoda', 'escrivaninha', 'roupeiro'] },
  { categoria: 'TV', palavras: ['tv', 'televisao', 'smart tv'] },
];
export const SALARIO_MINIMO_GARANTIDO = 2500;

export const PRODUTOS_SUGERIDOS = [
  'Sofá', 'Cama', 'Colchão', 'Guarda-roupa', 'Estante', 'Mesa', 'Cadeira', 'Rack',
  'Armário', 'Painel para TV', 'Poltrona', 'Cômoda', 'Escrivaninha',
  'Smart TV', 'TV',
  'Geladeira', 'Freezer', 'Fogão', 'Cooktop', 'Forno de embutir', 'Coifa', 'Micro-ondas',
  'Máquina de lavar', 'Lava e seca', 'Secadora de roupas', 'Ar-condicionado',
  'Adega climatizada', 'Purificador de água', 'Ventilador', 'Climatizador de ar',
  'Fritadeira elétrica', 'Cafeteira elétrica',
  // marcas — principalmente eletrodomésticos
  'Brastemp', 'Consul', 'Electrolux', 'LG', 'Samsung', 'Philco', 'Midea', 'Panasonic',
  'Fischer', 'Continental', 'Britânia', 'Mabe', 'Esmaltec', 'Springer', 'Elgin', 'Multilaser',
];

export function normalizeText(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const MARCAS = [
  'brastemp', 'consul', 'electrolux', 'lg', 'samsung', 'philco', 'midea', 'panasonic',
  'fischer', 'continental', 'britania', 'mabe', 'esmaltec', 'springer', 'elgin', 'multilaser',
  'aoc', 'sony', 'tcl', 'philips', 'semp', 'positivo',
];

/** Detecta se um "item" digitado é só tamanho/marca (ex: "43\" AOC"), não um produto à parte —
 * senão ele rouba metade do valor da venda de categorização/comissão do produto real. */
function ehApenasEspecificacao(item: string): boolean {
  let t = normalizeText(item);
  t = t.replace(/\d+\s*(["'”]|polegadas?)?/g, '');
  MARCAS.forEach(m => { t = t.replace(new RegExp(`\\b${m}\\b`, 'g'), ''); });
  t = t.replace(/[^a-z]/g, '');
  return t.length === 0;
}

export function splitProdutos(produto: string | null): string[] {
  const brutos = (produto || '').split(',').map(s => s.trim()).filter(Boolean);
  const itens: string[] = [];
  brutos.forEach(seg => {
    if (itens.length > 0 && ehApenasEspecificacao(seg)) {
      itens[itens.length - 1] = `${itens[itens.length - 1]}, ${seg}`;
    } else {
      itens.push(seg);
    }
  });
  return itens;
}

export function categoriaProduto(produto: string | null): CategoriaProduto {
  if (!produto) return 'OUTROS';
  const texto = normalizeText(produto);
  for (const grupo of CATEGORIA_PALAVRAS) {
    if (grupo.palavras.some(p => texto.includes(normalizeText(p)))) return grupo.categoria;
  }
  return 'OUTROS';
}

/** Divide o valor total da venda entre os produtos cadastrados e agrupa por categoria. */
export function valorPorCategoria(produto: string | null, valorTotal: number | null): Record<CategoriaProduto, number> {
  const totais: Record<CategoriaProduto, number> = { MOVEIS: 0, TV: 0, OUTROS: 0 };
  if (!valorTotal) return totais;
  const itens = splitProdutos(produto);
  if (itens.length === 0) { totais.OUTROS = valorTotal; return totais; }
  const valorPorItem = valorTotal / itens.length;
  itens.forEach(item => { totais[categoriaProduto(item)] += valorPorItem; });
  return totais;
}

export function comissaoVenda(produto: string | null, valorTotal: number | null): number {
  const porCategoria = valorPorCategoria(produto, valorTotal);
  return CATEGORIA_ORDEM.reduce((sum, cat) => sum + porCategoria[cat] * CATEGORIA_TAXA[cat], 0);
}
