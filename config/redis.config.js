// import { createClient } from "redis";


// const redisClient = createClient({
//     url: "redis://localhost:6379"
// })

// redisClient.on('error', err => console.error('Redis Client Error', err));

// await redisClient.connect();

// export default redisClient;


// Giả lập Redis bằng Map trong bộ nhớ (Local memory)
const storage = new Map();

const redisClient = {
    connect: async () => {
        console.log("RAM local)");
    },


    set: async (key, value, options) => {
        storage.set(key, value);
        if (options && options.EX) {
            setTimeout(() => {
                storage.delete(key);
            }, options.EX * 1000);
        }
    },


    get: async (key) => {
        return storage.get(key) || null;
    },

    del: async (key) => {
        storage.delete(key);
    }
};

export default redisClient;