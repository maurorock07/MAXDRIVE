======================================================================
         MAX DRIVE - GUIA DE INSTALAÇÃO DO BANCO DE DADOS LOCAL
======================================================================

Este servidor foi configurado para funcionar 100% de forma local, sem
nuvem e usando o banco de dados SQL profissional "PostgreSQL". 
Você não precisa do XAMPP ou phpMyAdmin. Usaremos o equivalente exato
para PostgreSQL, que já vem embutido na instalação!

SIGA OS PASSOS EXATAMENTE NA ORDEM ABAIXO:

----------------------------------------------------------------------
PASSO 1: INSTALAR O POSTGRESQL (COM O PAINEL PGADMIN INCLUSO)
----------------------------------------------------------------------
1. Acesse o site oficial: 
   https://www.postgresql.org/download/windows/
2. Baixe o instalador mais recente (versão 16 ou superior).
3. Abra o instalador e vá clicando em "Next" (Próximo).
   IMPORTANTE: Deixe todas as opções marcadas, principalmente o "pgAdmin 4".
4. SENHA: Vai aparecer uma tela pedindo uma senha para o superusuário 
   chamado "postgres". Digite uma senha fácil que você não vai esquecer!
   (Anotar essa senha é a coisa mais importante deste guia).
5. Porta: Deixe a padrão (5432).
6. Termine a instalação.

----------------------------------------------------------------------
PASSO 2: CRIAR O BANCO DO MAX DRIVE (AUTOMÁTICO)
----------------------------------------------------------------------
1. Volte na pasta do seu servidor MAX DRIVE.
2. Dê um clique duplo no arquivo "instalar_banco.bat".
3. Uma tela preta vai abrir pedindo a senha que você acabou de criar.
4. Digite a senha e aperte ENTER.
   (Ele vai criar a database 'maxdrive', rodar o sistema inteiro
   e configurar o seu servidor automaticamente em 5 segundos).

----------------------------------------------------------------------
PASSO 3: COMO VER MINHAS TABELAS E DADOS (Igual ao phpMyAdmin)
----------------------------------------------------------------------
Esqueça o phpMyAdmin. No PostgreSQL usamos o pgAdmin, que é melhor:
1. No menu Iniciar do Windows, pesquise e abra o programa "pgAdmin 4".
2. Ele vai abrir uma página no seu navegador (Google Chrome, Edge...).
3. Digite a senha que você criou na instalação.
4. No menu esquerdo, abra "Servers" -> "PostgreSQL 16" -> "Databases".
5. Você verá o banco "maxdrive" listado lá!
6. Para ver os dados: maxdrive -> Schemas -> public -> Tables.
7. Clique com botão direito na tabela (ex: users) -> "View/Edit Data" 
   -> "All Rows".

----------------------------------------------------------------------
PASSO 4: LIGAR O SERVIDOR
----------------------------------------------------------------------
1. Vá na pasta do servidor.
2. Dê um clique duplo em "servidor.bat".
3. Se tudo estiver certo, ele vai ligar o servidor e mostrar a mensagem:
   "PostgreSQL CONECTADO com sucesso! Banco: maxdrive"

PRONTO! Seu servidor Max Drive está 100% profissional e rodando
no seu próprio computador.
