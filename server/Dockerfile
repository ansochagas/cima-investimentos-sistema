FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm install --production || true
COPY . .
RUN npx prisma generate || true
ENV PORT=4000
EXPOSE 4000
CMD ["node","src/index.js"]

