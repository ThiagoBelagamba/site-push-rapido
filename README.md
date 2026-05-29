# Site Push Rápido

Repositório do painel web do Push Rápido em Next.js.

O frontend é desacoplado do backend e consome a API pública via `NEXT_PUBLIC_API_URL`.

## Estrutura

- `apps/web`: aplicação Next.js do painel
- `package.json`: scripts raiz para instalar e buildar o site
- `.gitignore`: exclusões do repositório do site

## Desenvolvimento local

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar ambiente

```bash
cp apps/web/.env.example apps/web/.env.local
```

Defina a URL da API em `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3. Subir o site

Na **raiz** do repositório `site-push-rapido` (não dentro de `apps/web`):

```bash
npm run dev
```

O painel ficará disponível em `http://localhost:3001`.

> Se aparecer `ENOWORKSPACES` ao rodar `next` dentro de `apps/web`, use sempre `npm run dev` na raiz. O script já aponta o Next para `apps/web` sem acionar o bug do npm 11 com workspaces.

## Build

```bash
npm run build
```

## Deploy no Netlify

Configuração recomendada:

- base do repositório: raiz
- build command: `npm install && npm run build`
- publish: gerenciado pelo suporte padrão do Netlify para Next.js
- variável obrigatória: `NEXT_PUBLIC_API_URL=https://pushrapidoapi.publix.ia.br`
- domínio sugerido: `admin.publix.ia.br`

## Observações

- não aponte o frontend para `/api` do próprio Netlify
- o painel precisa falar diretamente com a API pública
- a API precisa liberar CORS para o domínio final do painel

## Troubleshooting

- se o painel não conectar, confira `NEXT_PUBLIC_API_URL`
- se a tela travar após login, valide se a API está online e respondendo corretamente
- se mudar a API de produção, refaça o deploy com a variável nova
- **Webpack / caminho com `!`**: pastas como `!PUSH-RAPIDO` quebram o Webpack do Next (`exclamation mark (!) which is not allowed`). Os scripts usam **Turbopack** (`--turbopack`) no `dev` e no `build`. Solução definitiva: clonar/mover o projeto para um caminho sem `!` (ex.: `C:\workspace\push-rapido\`).
- rode `npm install` e `npm run dev` na **raiz** de `site-push-rapido`, não em `apps/` ou `apps/web`

## Scripts

- `npm run dev`: inicia o painel em `:3001`
- `npm run build`: gera o build de produção
- `npm run start`: sobe o build de produção


