# ngit
Cliente Git em CLI criado com o propósito de fazer um push de si mesmo para o repositório do GitHub.

Atualmente suporta apenas transporte HTTP(s) (smart), não suporta transporte SSH.

Comandos suportados:
- init
- add
- config (apenas para alterar configurações)
- commit
- remote add
- push

## Ferramentas utilizadas
- Node
- axios
- yargs

## Utilização
Neste exemplo estamos utilizando npx, npm e Node.

```bash
$ mkdir repositorio-teste
$ cd repositorio-teste
$ npx @criskell/ngit init
$ npx @criskell/ngit add .
$ npx @criskell/ngit config user.name "Nome do seu usuário"
$ npx @criskell/ngit config user.email "E-mail do seu usuário"
$ npx @criskell/ngit commit -m "Mensagem do commit"
$ npx @criskell/ngit remote add origin https://example.com/url-do-repositorio.git
$ npx @criskell/ngit push origin main
```