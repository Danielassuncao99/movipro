# MoviPro

Aplicativo web para profissionais de educação física organizarem alunos, treinos, avaliações, agenda e financeiro.

## Funcionalidades

- Cadastro e pesquisa de alunos
- Fichas separadas em Treino A, B, C, D e E
- Exercícios com séries, repetições, carga e observações
- Cronômetro de descanso por exercício
- Marcação de exercícios concluídos
- Edição de exercícios sem precisar excluí-los
- Avaliações físicas, agenda e controle financeiro
- Backup dos dados em JSON
- Layout responsivo e instalável como PWA
- Login e sincronização segura com Supabase

## Executar localmente

É necessário ter o Node.js instalado.

```powershell
npm start
```

Depois, acesse [http://localhost:4173](http://localhost:4173).
OU https://danielassuncao99.github.io/movipro/ 

## Armazenamento

Sem login, o aplicativo continua salvando no `localStorage` do navegador. Ao entrar ou criar uma conta, os dados são sincronizados com o Supabase e protegidos por Row Level Security (RLS).

O esquema do banco está versionado em `supabase/schema.sql`.

## Tecnologias

- HTML5
- CSS3
- JavaScript
- Service Worker e Web App Manifest
