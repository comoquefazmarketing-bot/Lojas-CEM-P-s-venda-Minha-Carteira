/** Regra mínima de senha forte: pelo menos 8 caracteres, com letra e número.
 * Retorna a mensagem de erro (em português) se a senha não passar, ou null se estiver ok. */
export function validarSenha(senha: string): string | null {
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(senha)) return 'A senha precisa ter pelo menos uma letra.';
  if (!/[0-9]/.test(senha)) return 'A senha precisa ter pelo menos um número.';
  return null;
}
