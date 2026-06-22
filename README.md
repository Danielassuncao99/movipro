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

## Executar localmente

É necessário ter o Node.js instalado.

```powershell
npm start
```

Depois, acesse [http://localhost:4173](http://localhost:4173).

## Armazenamento

Esta versão de demonstração salva os dados no `localStorage` do navegador. Cada dispositivo possui seus próprios dados; ainda não há conta de usuário ou banco de dados em nuvem.

## Tecnologias

- HTML5
- CSS3
- JavaScript
- Service Worker e Web App Manifest

