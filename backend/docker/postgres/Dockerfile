# Thin wrapper around the official Postgres image so you can pin the version
# and keep DB defaults in one place. Schema is applied by the app (Prisma db push).
FROM postgres:16-alpine

ENV POSTGRES_USER=zas
ENV POSTGRES_PASSWORD=zas
ENV POSTGRES_DB=zas

COPY init/*.sql /docker-entrypoint-initdb.d/

EXPOSE 5432
