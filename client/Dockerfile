# Two stages, because the build tools have no business being in the image that
# ships. `vite build` is a compile step: it turns src/ into static files, and
# after that neither node nor node_modules is needed to serve them.

FROM node:22-alpine AS build

WORKDIR /app

# The lockfile alone first, so a dependency change is the only thing that
# invalidates the install layer — editing a component doesn't reinstall React.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# `npm run build` is `tsc -b && vite build`, so a type error fails the image
# build rather than shipping a broken bundle.
RUN npm run build


FROM nginx:1.29-alpine

# Just the compiled output. The whole client image is the dist/ directory plus
# a web server, which is what makes swapping nginx for Apache — or for a CDN —
# a change to this file and nothing else.
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
