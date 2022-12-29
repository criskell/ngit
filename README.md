# ngit
Cliente Git em CLI criado com o propósito de fazer um push de si mesmo para o repositório do GitHub, do `init` ao `push`.

Atualmente suporta apenas transporte HTTP(s) (smart), não suporta transporte SSH.

Comandos suportados:
- init
- add
- config (apenas para alterar configurações)
- commit
- remote add
- push

## Instalação
É preciso ter o Node com npm instalado e o Git (para fazer o clone do repositório).

Execute os comandos:

```bash
$ git clone https://github.com/criskell/ngit.git
$ cd ngit
$ npm i
```

## Utilização
```bash
$ mkdir repositorio-teste
$ cd repositorio-teste
$ ngit init
$ ngit add .
$ ngit config user.name "Nome do seu usuário"
$ ngit config user.email "E-mail do seu usuário"
$ ngit commit -m "Mensagem do commit"
$ ngit remote add origin https://example.com/url-do-repositorio.git
$ ngit push origin main
```