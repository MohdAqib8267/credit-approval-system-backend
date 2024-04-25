FROM node:18-alpine

# create an app directory
WORKDIR /app

# Install app dependencies
COPY package.json ./

# Run npm install
RUN npm install

# bundle app source
COPY . .

# Run Prisma generate
RUN npx prisma generate

EXPOSE 8080

CMD ["npm", "start"]
