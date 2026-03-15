"use strict";
import { createRingBuffer } from "../native/ring_buffer.js";

export var createTokenBucketRateLimiter = (options) => {
    var rate = options.rate;
    var period = options.period;

    var burst = options.burst || 1;


    var buff_exponent = options.exponent || 8;
    var buff_overwrite = options.overwrite || false;

    var buffer = createRingBuffer(
        () => null,
        buff_exponent,
        buff_overwrite
    );

    var tick_time = options.tick_time || 10;

    var tokens = burst; 

    var interval = null;

    var periodTicks = ((period / tick_time) | 0) + 1;
    var periodCounter = 0;
    var executedCounter = 0;

    var refillIntervalTicks = ((period / (rate * tick_time)) | 0) + 1;
    var counter = 0;


    return {
        schedule: (task, args=[]) => {
            return new Promise((resolve, reject) => {
                try {
                    buffer.push({
                        task,
                        args, 
                        resolve,
                        reject
                    });
                } catch (error) {
                    reject(error);
                }

                if (!interval) {
                    interval = setInterval(() => {
                        if (buffer.isEmpty()) {
                            if (tokens >= burst) {
                                clearInterval(interval);
                                interval = null;
                            }
                        }
                        else if (tokens) {
                            tokens--;
                            executedCounter++;
                            var item = buffer.shift();

                            try {
                                Promise.resolve(item.task(...item.args))
                                    .then(item.resolve, item.reject);
                            } catch (error) { item.reject(error) }
                        }

                        periodCounter++;
                        counter++;

                        if (periodCounter >= periodTicks) {
                            executedCounter = 0;
                            tokens = burst;
                            periodCounter = 0;
                            console.log("===================PERIODDDDDDDDD ==================")
                        }

                        if (counter >= refillIntervalTicks) {
                            tokens = (tokens < burst && executedCounter < rate) ? tokens+1 : tokens;
                            counter = 0;
                        }
                    }, tick_time);
                }
            });
        }
    }
}

var makeTask = (text) => new Promise(r => setTimeout(() => {console.log(text); r()}, 1));
var main = () => {
    var rl = createTokenBucketRateLimiter({rate: 20, period: 7000, burst: 10});

    for (let i = 0; i<12; i++)
        rl.schedule(makeTask, [`hello ${i}`]);


    setTimeout(() => {
         for (let i = 0; i<12; i++)
            rl.schedule(makeTask, [`govno ${i}`]);

    }, 5_000);

    //var b = createRingBuffer(() => 0, 4);

    //Array.from("helloWorld").forEach(x => b.push(x));
    //while (b.peek())
    //    console.log(b.shift())
}
main()