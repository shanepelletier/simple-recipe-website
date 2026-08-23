# A simple recipe website

A simple recipe website built using Django, PostgreSQL, and React. 

## Features

- Account registration and login.
- Admin pages for managing everything, accessible by administrators.
- Two types of accounts: "Authors" and "Moderators".
    - Authors are the everyday users of the application, and can create, edit, and delete their own recipes as well as view and copy recipes created by other users. Authors can also rate recipes on a scale of 1 to 5, and add comments ot recipes with an optional photo.
    - Moderators have all the permissions of Users, but can also edit and delete any recipe, tag, or ingredient.
- Recipes have two views: a grid overview that supports sorting and filtering, and a details view that shows the details of a single recipe.
- A recipe has a name, tags, rating, list of ingredients, and steps. Ingredients are structured quantities which are combined together when added to shopping lists.
- A shopping list can be created by adding all ingredients from a recipe or by adding individual ingredients directly to the shopping list.

# Deploying

Deploying the project to a production-like state requires [Docker Compose](https://docs.docker.com/compose/) to be installed.

This is "production-like" because it uses technologies and methods that are not suitable for a full production deployment. Some examples: the Django development server is used rather than using a proper web server, uploaded images are stored directly on a shared volume rather than using a proper CDN, and secrets are stored in a `.env` file rather than being managed by something like Hashicorp Vault or a cloud-provided manager. This setup exists to ensure the frontend application is mostly decoupled from the backend server, so future productionization can proceed smoothly.

Firstly, clone the repository and switch into the cloned directory:

```
git clone https://github.com/shanepelletier/simple-recipe-website
cd simple-recipe-website
```

Then copy the provided `.env.example` file to `.env`:

```
cp .env.example .env
```

Optionally change `DB_PASSWORD`, `DB_ADMIN_PASSWORD`, and `DJANGO_SECRET_KEY` in `.env` to more secure values.

Run the following commands to start all the services and seed the demo:

```
docker compose up --build -d
docker compose exec app python config/manage.py seed --demo
```

Note down the passwords printed by the seed command, as they are randomly generated each run.

Open http://localhost:8080 to see the running website.

To stop, run `docker compose down`; add `-v` to discard the database and uploaded photos as well.

# Developing

This project's Python dependencies are managed by [`uv`](https://github.com/astral-sh/uv); the Node.js dependencies are managed by [`npm`](https://github.com/npm/cli). Development also requires a Postgres DB; one can be deployed by running `docker compose up -d db` in the root of the repository.

Firstly, clone the repository and switch into the cloned directory:

```
git clone https://github.com/shanepelletier/simple-recipe-website
cd simple-recipe-website
```

Then copy the provided `.env.example` file to `.env`:

```
cp .env.example .env
```

In one terminal:

```
cd server
uv sync
uv run --env-file ../.env python config/manage.py migrate
uv run --env-file ../.env python config/manage.py seed --demo
uv run --env-file ../.env python config/manage.py runserver 8000
```

In a second terminal:

```
cd client
npm install
npm run dev
```

Open http://localhost:5173 to see the website.

To stop, press `Ctrl+C` in both terminals and run `docker compose down db`; add `-v` to discard the database and uploaded photos as well.
