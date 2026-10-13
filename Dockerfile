FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY public ./public
ENV PORT=3188
USER node
EXPOSE 3188
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:3188/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server.mjs"]
