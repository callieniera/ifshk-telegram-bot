export default {
    set(now, target) {
        let result = ((59 - now.getMinutes()) * 60 * 1000)
            + ((59 - now.getSeconds()) * 1000)
            + (1000 - now.getMilliseconds());
        let hour = now.getHours();
        if (hour > (target - 1)) {
            result = result + ((23 - hour) * 60 * 60 * 1000) + (target * 60 * 60 * 1000);
        } else {
            result = result + (((target - 1) - hour) * 60 * 60 * 1000);
        }
        return result
    },
    hour(now, interval) {
        return ((interval - (now.getHours() % interval) - 1) * 60 * 60 * 1000)
            + ((59 - now.getMinutes()) * 60 * 1000)
            + ((59 - now.getSeconds()) * 1000)
            + (1000 - now.getMilliseconds())
    },
    minute(now, interval) {
        return ((interval - (now.getMinutes() % interval) - 1) * 60 * 1000)
            + ((59 - now.getSeconds()) * 1000)
            + (1000 - now.getMilliseconds())
    }
}