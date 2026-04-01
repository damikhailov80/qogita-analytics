/**
 * Получает курс обмена PLN к EUR из переменных окружения
 * @throws Error если PLN_TO_EUR_RATE не установлен
 */
export function getPlnToEurRate(): number {
    const rate = process.env.PLN_TO_EUR_RATE;

    if (!rate) {
        throw new Error('PLN_TO_EUR_RATE environment variable is not set');
    }

    const parsedRate = parseFloat(rate);

    if (isNaN(parsedRate) || parsedRate <= 0) {
        throw new Error(`Invalid PLN_TO_EUR_RATE value: ${rate}`);
    }

    return parsedRate;
}

/**
 * Конвертирует цену из PLN в EUR
 * @param pricePLN - цена в PLN
 * @returns цена в EUR
 */
export function convertPlnToEur(pricePLN: number): number {
    return pricePLN / getPlnToEurRate();
}
