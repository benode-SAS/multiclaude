# Sécurité

## Signaler une faille

Écrivez à benjamin@benode.fr plutôt que d'ouvrir une issue publique. Une réponse
part sous quelques jours.

## Modèle de menace

multiclaude exécute du code sur la machine hôte : c'est sa raison d'être. Ce qui
suit est **par conception**, et n'est donc pas une faille :

- Un membre authentifié peut faire exécuter des commandes par l'agent, dans le
  dossier de travail d'une conversation.
- L'aperçu HTML exécute le JavaScript du document rendu, dans une iframe sans
  `allow-same-origin` : origine opaque, pas d'accès à l'application ni à l'API.

Ce qui en revanche nous intéresse : contournement de l'authentification, accès aux
données d'une instance depuis un compte non autorisé, échappement du bac à sable de
l'aperçu, lecture de fichiers hors du dossier de travail par les routes de fichiers,
et tout ce qui permet d'agir sans passer par la validation humaine des permissions.

## Déployer sans se mettre en danger

- Ne pas exécuter le serveur en `root`.
- Fermer les inscriptions (`SIGNUP_ENABLED=false`) dès que l'instance est joignable
  depuis Internet.
- `ALWAYS_ASK_TOOLS=Bash` pour faire confirmer chaque commande.
- Servir en HTTPS : le cookie de session passe alors en `secure` automatiquement.
