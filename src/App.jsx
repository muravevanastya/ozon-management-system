import './App.css';
import React, { useState, useEffect } from 'react';
import config from './config'
import * as XLSX from 'xlsx';

// const moment = require('moment-timezone');


function App() {

  const API_KEY = config.API_KEY
  const SELLER_ID = config.SELLER_ID

  const [warehouses, setWarehouses] = useState([])
  const [hiddenWarehouses, setHiddenWarehouses] = useState([])
  const [products, setProducts] = useState([])
  const [skus, setSkus] = useState([])
  const [goodsInWarehouses, setGoodsInWarehouses] = useState([])
  const [salesInWarehouses, setSalesInWarehouses] = useState([])
  const [maxSales, setMaxSales] = useState({})

  const today = new Date().toISOString().slice(0, 10); // Текущая дата
  // today.setHours(today.getUTCHours() + 3);
  // const twoWeeksAgo = new Date(today);
  // twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14).toISOString().slice(0, 10)
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(localStorage.getItem('startDate') || twoWeeksAgo);
  const [endDate, setEndDate] = useState(localStorage.getItem('endDate') || today);
  
  function saveDataToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data))
  }

  function loadDataFromStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null
  }

  async function fetchWarehouse() {
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      const response = await fetch('https://api-seller.ozon.ru/v1/warehouse/list', {
        method: 'POST',
        headers: {
          'Content-type': 'application/json',
          'Api-Key': API_KEY,
          'Client-Id': SELLER_ID
        }
      });
      const data = await response.json();
      setWarehouses(data.result);
      saveDataToStorage('warehouses', data.result);
    } catch (error) {
      console.error('Error fetching warehouses: ', error);
    }
  }

    async function fetchProducts() {
  // const fetchProducts = useCallback(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));

      try {
        const response = await fetch('https://api-seller.ozon.ru/v2/product/list', {
          method: 'POST',
          headers: {
            'Content-type': 'application/json',
            'Api-Key': API_KEY,
            'Client-Id': SELLER_ID
          }
        });
        const data = await response.json();
        // const data1 = data.result.items.filter(d => d.product_id === 694885245)
        setProducts(data.result.items);
        saveDataToStorage('products', data.result.items);
        // setProducts(data1);
      } catch (error) {
        console.error('Error fetching products: ', error);
      }
    // }, [])
    // fetchProducts();
  }
  // }, []);


  // useEffect(() => {
    async function fetchSkus() {
    // const fetchSkus = useCallback(async () => {
      try {
        const skusPromises = products.map(async (product, index) => {
          await new Promise(resolve => setTimeout(resolve, index * 100));
          const skuResponse = await fetch(`https://api-seller.ozon.ru/v2/product/info`, {
            method: 'POST',
            headers: {
              'Content-type': 'application/json',
              'Api-Key': API_KEY,
              'Client-Id': SELLER_ID
            },
            body: JSON.stringify({ product_id: product.product_id })
          });
          const skuData = await skuResponse.json();

          let sku = skuData.result.sku;
          if (sku === 0){
            let fb_skus = skuData.result.sources;
            fb_skus.forEach(fb => {
              if (fb.source === "fbs" && fb.is_enabled){
                sku = fb.sku;
              }
            })
          }
          return {
            product_id: product.product_id,
            sku: sku
          };
        });
        const resolvedSkus = await Promise.all(skusPromises);
        setSkus(resolvedSkus);
        saveDataToStorage('skus', resolvedSkus);
        // console.log("gh", loadDataFromStorage('skus'), resolvedSkus);
      // }
      } catch (error) {
        console.error('Error fetching skus: ', error);
      }
    // if (products.length > 0) {
    //   fetchSkus();
    // }
    }
  // }, [products]);



  // useEffect(() => {
    async function fetchSalesSpeedForWarehouses() {
      await new Promise(resolve => setTimeout(resolve, 100));
    
      try {
        setSalesInWarehouses([])
        const statusList = [
          "awaiting_packaging",
          "awaiting_deliver",
          "delivering",
          "delivered",
        ];
        const allSalesSpeedData = [];
        const warehouseIds = warehouses.map(warehouse => warehouse.warehouse_id.toString());
        const startDateObj = new Date(startDate); // Start date object
        const endDateObj = new Date(endDate); // End date object
        // const chunkSize = 2; // Chunk size for API requests
    
        // Iterate over each day within the specified period
        for (let currentDate = new Date(startDateObj); currentDate <= endDateObj; currentDate.setDate(currentDate.getDate() + 1)) {
          // const sinceDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).toISOString(); // Start date for current day
          // const toDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).toISOString(); // End date for current day
        const currentDateStr = currentDate.toISOString().slice(0, 10);
          // toDate.setUTCHours(23, 59, 59, 999)
          // Loop through warehouseIds in chunks to prevent exceeding API request limit
          // for (let i = 0; i < warehouseIds.length; i += chunkSize) {
            // const warehouseIdsChunk = warehouseIds.slice(i, i + chunkSize);
            const salesSpeedPromises = statusList.map(async (status) => {
              if (warehouseIds.length > 0) {
                const response = await fetch('https://api-seller.ozon.ru/v3/posting/fbs/list', {
                  method: 'POST',
                  headers: {
                    'Content-type': 'application/json',
                    'Api-Key': API_KEY,
                    'Client-Id': SELLER_ID
                  },
                  body: JSON.stringify({
                    "dir": "ASC",
                    "filter": {
                      "since": currentDateStr + "T00:00:00.000Z",
                      "status": status,
                      "to": currentDateStr + "T23:59:59.999Z",
                      "warehouse_id": warehouseIds
                    },
                    "limit": 1000,
                    "offset": 0
                  })
                });
    
                const data = await response.json();
                const processedOrderIds = [];
    
                if (data && data.result && data.result.postings) {
                  data.result.postings.forEach(operation => {
                    if (!processedOrderIds.includes(operation.order_id)) {
                      const salesSpeedData = {
                        salesSkus: operation.products.map(product => product.sku),
                        salesQuantities: operation.products.map(product => product.quantity),
                        salesOrderId: operation.order_id,
                        salesWarehouseId: operation.delivery_method.warehouse_id,
                      };
                      allSalesSpeedData.push(salesSpeedData);
                      processedOrderIds.push(operation.order_id);
                    }
                  });
                }
              }
            });
            // console.log([currentDateStr + "T00:00:00.000Z", currentDateStr + "T23:59:59.999Z"]);
            await Promise.all(salesSpeedPromises);
          }
        // }
    
        setSalesInWarehouses(allSalesSpeedData)
        saveDataToStorage('salesForWarehouses', allSalesSpeedData);
      } catch (error) {
        console.error('Error fetching sales speed for warehouses: ', error);
      }
    }
    
    
    // }, [warehouses, startDate])

    // fetchSalesSpeedForWarehouses()
// (async () => {
//   await fetchSalesSpeedForWarehouses();
// })();

    // if (warehouses.length > 0 && startDate && endDate) { // Проверяем, что данные складов получены и даты выбраны
    //   fetchSalesSpeedForWarehouses(startDate, endDate); // Передаем выбранные даты в функцию запроса
    // }

    // if (!startDate || !endDate) {
    //   // alert("Please select both start and end dates.");
    //   return;
    // }
    
  // }, [warehouses])



  // async function fetchMaxSales() {
  //   try {
  //     const statusList = [
  //       "awaiting_packaging",
  //       "awaiting_deliver",
  //       "delivering", 
  //       "delivered"
  //     ];
  
  //     const allSalesData = {};
  
  //     const warehouseIds = warehouses.map(warehouse => warehouse.warehouse_id.toString());
  //     const today = new Date();
  //     today.setUTCHours(23, 59, 59, 999);
  //     // const ninetyDaysAgo = new Date(today);
  //     const ninetyDaysAgo = new Date();
  //     ninetyDaysAgo.setDate(today.getDate() - 10)
  //     ninetyDaysAgo.setUTCHours(0, 0, 0, 0);
  
  //     const salesPromises = statusList.map(async (status) => {
  //       const response = await fetch('https://api-seller.ozon.ru/v3/posting/fbs/list', {
  //         method: 'POST',
  //         headers: {
  //           'Content-type': 'application/json',
  //           'Api-Key': API_KEY,
  //           'Client-Id': SELLER_ID
  //         },
  //         body: JSON.stringify({
  //           "dir": "ASC",
  //           "filter": {
  //             "since": ninetyDaysAgo.toISOString(),
  //             "status": status,
  //             "to": today.toISOString(),
  //             "warehouse_id": warehouseIds
  //           },
  //           "limit": 1000,
  //           "offset": 0
  //         })
  //       });
  //       const data = await response.json();
  //       if (data && data.result && data.result.postings) {
  //         data.result.postings.forEach(operation => {
  //           operation.products.forEach(product => {
  //             const salesDate = new Date(operation.in_process_at).toISOString().slice(0, 10);
  //             const productId = product.offer_id;
  //             const quantity = product.quantity;
  
  //             if (!allSalesData[productId]) {
  //               allSalesData[productId] = [];
  //             }
  // console.log(allSalesData);
  //             const existingSale = allSalesData[productId].find(sale => sale.date === salesDate);
  //             if (existingSale) {
  //               existingSale.quantity += quantity;
  //             } else {
  //               allSalesData[productId].push({ date: salesDate, quantity: quantity });
  //             }
  //           });
  //         });
  //       }
  //     });
  
  //     await Promise.all(salesPromises);
  
  //     // Найдем максимальное количество продаж для каждого товара
  //     const maxSales = {};
  //     for (const productId in allSalesData) {
  //       const sales = allSalesData[productId];
  //       let maxQuantity = 0;
  //       let maxDate = '';
  //       sales.forEach(sale => {
  //         if (sale.quantity > maxQuantity) {
  //           maxQuantity = sale.quantity;
  //           maxDate = sale.date;
  //         }
  //       });
  //       maxSales[productId] = { date: maxDate, quantity: maxQuantity };
  //     }
  
  //     // console.log('Max Sales:', maxSales);
  //     saveDataToStorage('maxSales', maxSales);
  //     setMaxSales(maxSales)
  
  //   } catch (error) {
  //     console.error('Error fetching max sales: ', error);
  //   }
  // }

  
  async function fetchMaxSales() {
    // await new Promise(resolve => setTimeout(resolve, 100));
    try {
      setMaxSales([])
      const statusList = [
        "awaiting_packaging",
        "awaiting_deliver",
        "delivering", 
        "delivered"
      ];
      const warehouseIds = warehouses.map(warehouse => warehouse.warehouse_id.toString());
      const today = new Date();
      // today.setUTCHours(23, 59, 59, 999);
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(today.getDate() - 90)
      // ninetyDaysAgo.setUTCHours(0, 0, 0, 0);
  
      const maxSalesData = {};
  
      for (let currentDate = new Date(ninetyDaysAgo); currentDate <= today; currentDate.setDate(currentDate.getDate() + 1)) {
        const currentDateStr = currentDate.toISOString().slice(0, 10);
        const salesForCurrentDate = {};
  
        for (const status of statusList) {
          const response = await fetch('https://api-seller.ozon.ru/v3/posting/fbs/list', {
            method: 'POST',
            headers: {
              'Content-type': 'application/json',
              'Api-Key': API_KEY,
              'Client-Id': SELLER_ID
            },
            body: JSON.stringify({
              "dir": "ASC",
              "filter": {
                "since": currentDateStr + "T00:00:00.000Z",
                "status": status,
                "to": currentDateStr + "T23:59:59.999Z",
                "warehouse_id": warehouseIds
              },
              "limit": 1000,
              "offset": 0
            })
          });
          const data = await response.json();
  
          if (data && data.result && data.result.postings) {
            data.result.postings.forEach(operation => {
              operation.products.forEach(product => {
                if (!salesForCurrentDate[product.sku]) {
                  salesForCurrentDate[product.sku] = 0;
                }
                salesForCurrentDate[product.sku] += product.quantity;
              });
            });
          }
        }
          Object.keys(salesForCurrentDate).forEach(sku => {
          if (!maxSalesData[sku] || maxSalesData[sku].quantity < salesForCurrentDate[sku]) {
            maxSalesData[sku] = {
              date: currentDateStr,
              quantity: salesForCurrentDate[sku]
            };
          }
        });
      }
  
      setMaxSales(maxSalesData);
      saveDataToStorage('maxSales', maxSalesData);
      // console.log(maxSalesData);
  
    } catch (error) {
      console.error('Error fetching max sales: ', error);
    }
  }
  
  

//   async function fetchMaxSales() {
//     // const fetchSalesSpeedForWarehouses = useCallback(async () => {

//     await new Promise(resolve => setTimeout(resolve, 100));

//     try {
//       setMaxSales([])
//       const statusList = [
//         "awaiting_packaging",
//         "awaiting_deliver",
//         "delivering", 
//         "delivered"
//       ];
//       const allSalesSpeedData = [];
//       const warehouseIds = warehouses.map(warehouse => warehouse.warehouse_id.toString());
//       // const warehouseIds = warehouses.filter(warehouse => warehouse.warehouse_id != null).map(warehouse => warehouse.warehouse_id.toString());

//       const today = new Date();
//       today.setUTCHours(23, 59, 59, 999);
//       const ninetyDaysAgo = new Date(today);
//       ninetyDaysAgo.setDate(today.getDate() - 90)
//       ninetyDaysAgo.setUTCHours(0, 0, 0, 0);

//       // today.setDate(today.getDate() - 1)

//       // const sinceDate = new Date(startDate).toISOString();
//       // const endDate = moment.tz('Europe/Moscow').toISOString();
//       // const endDateObj = new Date(endDate);
//       // endDateObj.setUTCHours(23, 59, 0, 0); // Устанавливаем часы на 23, минуты на 59, секунды и миллисекунды на 0
//       // const toDate = endDateObj.toISOString();
      
//       // const toDate = new Date(endDate).toISOString()
//       // const toDate = new Date(endDate).toISOString();
//       // today.setHours(today.getUTCHours() + 3);
// //         const sinceDate = convertDateToUTCString(startDate); // Преобразование выбранной пользователем даты
// // const toDate = convertDateToUTCString(endDate);

      
//       // const chunkSize = 2; // Размер части, с которым API работает корректно
//       // for (let i = 0; i < warehouseIds.length; i += chunkSize) {
//       //   const warehouseIdsChunk = warehouseIds.slice(i, i + chunkSize);
//         const salesSpeedPromises = statusList.map(async (status) => {
//           if (warehouseIds.length > 0) {
//             const since = "2024-04-02T00:00:00.000Z";
//             const to = "2024-04-05T23:59:59.000Z"
//             const response = await fetch('https://api-seller.ozon.ru/v3/posting/fbs/list', {
//               method: 'POST',
//               headers: {
//                 'Content-type': 'application/json',
//                 'Api-Key': API_KEY,
//                 'Client-Id': SELLER_ID
//               },
//               body: JSON.stringify({
//                 "dir": "ASC",
//                 "filter": {
//                   "since": ninetyDaysAgo.toISOString(),
//                   // "since": since,
//                   "status": status,
//                   "to": today.toISOString(),
//                   // "to": to,
//                   "warehouse_id": warehouseIds
//                   // "warehouse_id": ["1020000964079000"]
//                 },
//                 "limit": 1000,
//                 "offset": 0
//               })
//             });
//             const data = await response.json();
//             const processedOrderIds = [];
//             if (data && data.result && data.result.postings) {
//               data.result.postings.forEach(operation => {
//                 // if (!processedOrderIds.includes(operation.order_id)) {
//                   const salesSpeedData = {
//                     salesSkus: operation.products.map(product => product.sku),
//                     salesQuantities: operation.products.map(product => product.quantity),
//                     // salesOrderId: operation.order_id,
//                     // salesStatus: operation.status,
//                     // salesWarehouseId: operation.delivery_method.warehouse_id,
//                     salesDate: operation.in_process_at,
//                     // salesDateInProcess: operation.in_process_at,
//                     // salesDateShipment: operation.shipment_date,
//                     // salesDateDelivering: operation.delivering_date,
//                     // posting_number: operation.posting_number,
//                   };
//                   allSalesSpeedData.push(salesSpeedData);
//                   processedOrderIds.push(operation.order_id);                  
//                 // }
//                 // console.log(ninetyDaysAgo, today);
//               });
              
//             }
//           }
//           // await Promise.all(salesSpeedPromises);
  
//         })
//           await Promise.all(salesSpeedPromises);

//       // }

//     // let indeh = 0;
//       // console.log(allSalesSpeedData); 
//       // console.log(warehouseIds);
//       // console.log(today, ninetyDaysAgo);
//       // console.log(today, weekStartDate);
//       setMaxSales(allSalesSpeedData)    
//       saveDataToStorage('maxSales', allSalesSpeedData);
//       // saveDataToStorage('salesForWarehouses', allSalesSpeedData);
//       // console.log('salesForWarehouses');

//     } catch (error) {
//       console.error('Error fetching sales speed for warehouses: ', error);
//     }
//   }

  // useEffect(() => {
    // const fetchGoodsInWarehouses = useCallback(async () => {
    async function fetchGoodsInWarehouses() {
      try {
        const validSkus = skus.filter(item => item.sku > 0)
        const goodsPromises = validSkus.map(async (item, index) => {
          // if (!item) return null;
          await new Promise(resolve => setTimeout(resolve, index * 100));
          const response = await fetch(`https://api-seller.ozon.ru/v1/product/info/stocks-by-warehouse/fbs`, {
            method: 'POST',
            headers: {
              'Content-type': 'application/json',
              'Api-Key': API_KEY,
              'Client-Id': SELLER_ID
            },
            body: JSON.stringify({ sku: [item.sku] })
          })
          const data = await response.json();

        return data.result ? data.result.map(record => ({
          productId: record.product_id,
          warehouseId: record.warehouse_id,
          present: record.present,
          reserved: record.reserved,
          sku: record.sku
        })) : []; // Return an empty array if data.result is undefined
      });
        const resolvedGoods = await Promise.all(goodsPromises);
        // Флэттим результат, т.к. сейчас он представляет собой массив массивов
        const flatGoods = resolvedGoods.flat();
        setGoodsInWarehouses(flatGoods);
        saveDataToStorage('goodsInWarehouses', flatGoods);
        // console.log('goodsInWarehouses');
  
      } catch (error) {
        console.error('Error fetching goods in warehouses: ', error);
      }
    }
    // }, [skus])
    // const storedGoodsInWarehouses = loadDataFromStorage('goodsInWarehouses');
    // if (storedGoodsInWarehouses) {
    //     setGoodsInWarehouses(storedGoodsInWarehouses);
    // } 
  //   fetchGoodsInWarehouses()
  // }, [skus])

  useEffect(() => {
    const storedWarehouses = loadDataFromStorage('warehouses');
    if (storedWarehouses && storedWarehouses.length > 0) {
      setWarehouses(storedWarehouses);
    }
  }, [])

  useEffect(() => {
    const storedProducts = loadDataFromStorage('products');
    if (storedProducts) {
      setProducts(storedProducts);
    } 
  }, [])

  useEffect(() => {
    const storedSkus = loadDataFromStorage('skus');
    if (storedSkus) {
      setSkus(storedSkus);
    }
  }, [])

  useEffect(() => {
    const storedSalesForWarehouses = loadDataFromStorage('salesForWarehouses');
    if (storedSalesForWarehouses) {
      setSalesInWarehouses(storedSalesForWarehouses);
    }
  }, []);

  useEffect(() => {
    const storedMaxSales = loadDataFromStorage('maxSales');
    if (storedMaxSales) {
      setMaxSales(storedMaxSales);
    }
}, []);

  useEffect(() => {
    const storedGoodsInWarehouses = loadDataFromStorage('goodsInWarehouses');
    if (storedGoodsInWarehouses) {
        setGoodsInWarehouses(storedGoodsInWarehouses);
    } 
  }, [])

  useEffect(() => {
    const fetchProductsAndWarehouse = async () => {
      await Promise.all([
        fetchProducts(),
        fetchWarehouse()
      ]);
    };

    fetchProductsAndWarehouse();
  }, []);


  useEffect(() => {
    if (products.length > 0) {
      fetchSkus();
    }
  }, [products]);


  useEffect(() => {
    if (skus.length > 0) {
      Promise.all([
        fetchGoodsInWarehouses(),
        fetchSalesSpeedForWarehouses(),
        fetchMaxSales()
      ]);
    }
  }, [skus]);




  const handleUpdateData = async () => {
    try {
      const startDateInput = document.getElementById('start_date');
      const endDateInput = document.getElementById('end_date');
      const newStartDate = startDateInput.value;
      const newEndDate = endDateInput.value;

      localStorage.setItem('startDate', newStartDate);
      localStorage.setItem('endDate', newEndDate);

      setStartDate(newStartDate);
      setEndDate(newEndDate);

    } catch (error) {
      console.error('Error updating data: ', error);
    }
  };

  useEffect(() => {
    // if (startDate && endDate) {
      fetchSalesSpeedForWarehouses();
    // }
  }, [startDate, endDate]);

  
  function getGoodsForWarehouses(product, warehouse, goodsInWarehouses) {
    const warehouseEntry = goodsInWarehouses.find((item) =>
        item.productId === product.product_id &&
        item.warehouseId === warehouse.warehouse_id
    );
    return warehouseEntry ? warehouseEntry.present - warehouseEntry.reserved : '-';
  }

  function getSalesSpeedForWarehouses(product, warehouse) {
    const skuEntry = skus.find(entry => entry.product_id === product.product_id);
    if (!skuEntry) {
      return '-';
    }

    let totalSales = 0;
    salesInWarehouses.forEach((sale) => {
      if (sale.salesWarehouseId === warehouse.warehouse_id) {
        sale.salesSkus.forEach((sku, index) => {
          if (sku === skuEntry.sku) {
            const quantity = sale.salesQuantities[index];
            totalSales += quantity;
          }
        })
      }
    });
    // return totalSales;
    const totalDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
    let salesSpeed = totalSales / (totalDays + 1)

    if (salesSpeed % 1 === 0) {
      salesSpeed = salesSpeed.toFixed(0);
    } else {
      salesSpeed = salesSpeed.toFixed(1)
    }
    console.log(totalDays);

    return salesSpeed
  }

  function calculateRatio(product, warehouse) {
    const goods = getGoodsForWarehouses(product, warehouse, goodsInWarehouses);
    const salesSpeed = getSalesSpeedForWarehouses(product, warehouse)

    let result = salesSpeed !== 0 ? goods / salesSpeed : "-";

    if (!isFinite(result)) {
      result = "-";
    } else {
      result = Number.isInteger(result) ? result : parseFloat(result.toFixed(1));
    }

    return result;
  }

  function getSalesSpeed(product) {
    const skuEntry = skus.find(entry => entry.product_id === product.product_id);
    if (!skuEntry) {
      return '-';
    }

    let totalSales = 0;
    salesInWarehouses.forEach((sale) => {
    //   if (sale.salesWarehouseId === warehouse.warehouse_id) {
        sale.salesSkus.forEach((sku, index) => {
          if (sku === skuEntry.sku) {
            const quantity = sale.salesQuantities[index];
            totalSales += quantity ;
          }
        })
    //   }
    });
    // return totalSales;
    const totalDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
    let salesSpeed = totalSales / (totalDays + 1)

    if (salesSpeed % 1 === 0) {
      salesSpeed = salesSpeed.toFixed(0);
    } else {
      salesSpeed = salesSpeed.toFixed(1)
    }
    // console.log(totalDays);
    return salesSpeed
  }

  function getMaxSales(product) {
    const skuEntry = skus.find(entry => entry.product_id === product.product_id);
    if (!skuEntry) {
      return '-';
    }
  
    const maxSalesEntry = maxSales[skuEntry.sku];
    if (maxSalesEntry) {
      return maxSalesEntry.quantity;
    } else {
      return '-';
    }
  }

  function getMaxSalesDate(product) {
    const skuEntry = skus.find(entry => entry.product_id === product.product_id);
    if (!skuEntry) {
      return '-';
    }
  
    const maxSalesEntry = maxSales[skuEntry.sku];
    if (maxSalesEntry) {
      return maxSalesEntry.date;
    } else {
      return '-';
    }
  }

  function hideWarehouses(warehouseId) {
    let updatedHiddenWarehouses;
    if (hiddenWarehouses.includes(warehouseId)) {
      updatedHiddenWarehouses = hiddenWarehouses.filter(id => id !== warehouseId);
    } else {
      updatedHiddenWarehouses = [...hiddenWarehouses, warehouseId];
    }
    setHiddenWarehouses(updatedHiddenWarehouses);
    saveDataToStorage('hiddenWarehouses', updatedHiddenWarehouses)
  }

  useEffect(() => {
    const storedHiddenWarehouses = loadDataFromStorage('hiddenWarehouses' || '[]');
    if (storedHiddenWarehouses) {
      setHiddenWarehouses(storedHiddenWarehouses)
    }
  }, [])

  function restoreAllWarehouses() {
    setHiddenWarehouses([]);
    localStorage.removeItem('hiddenWarehouses');
  };  

  const handleExportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.table_to_sheet(document.querySelector('.table'));
  
    const mergesToRemove = worksheet['!merges'].filter(merge => {
      const startColumn = merge.s.c;
      const endColumn = merge.e.c;
      return (startColumn === 3 || endColumn === 3) || (startColumn === 2 || endColumn === 2);
    });
    mergesToRemove.forEach(merge => {
      const index = worksheet['!merges'].indexOf(merge);
      worksheet['!merges'].splice(index, 1);
    });
  
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const autoFilterRange = {
      s: { c: range.s.c, r: range.s.r + 1 },
      e: { c: range.e.c, r: range.s.r + 1 }
    };
    const autoFilterRef = XLSX.utils.encode_range(autoFilterRange);
  
    worksheet['!autofilter'] = { ref: autoFilterRef };
  
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  
    XLSX.writeFile(workbook, 'ozon_table_data.xlsx');
  };

  return (
    <div className='App'>
      {/* <button className='dates__button' onClick={restoreAllWarehouses}>Восстановить склады</button> */}
      <div className='dates'>
        <div className='dates__container'>
          <label className='dates__title' htmlFor="start">Начало периода:</label>
          <input className='dates__date' type="date" id="start_date" defaultValue={startDate}/>
        </div>
        <div className='dates__container'>
          <label className='dates__title' htmlFor="start">Конец периода:</label>
          <input className='dates__date' type="date" id="end_date" defaultValue={endDate}/>
        </div>
        <button className='dates__button' onClick={handleUpdateData}>Обновить данные</button>
        <button className='dates__button' onClick={handleExportToExcel}>Скачать .xlsx</button>
      <button className='dates__button' onClick={restoreAllWarehouses}>Восстановить склады</button>
      </div>
      <div className='body'>
        <table className='table'>
          <thead>
            <tr>
              <th colSpan="2" className='table__title table__title-border'>Максимальные продажи/сутки</th>
              <th rowSpan="2" className='table__title table__title-border'>Скорость продаж</th>
              <th rowSpan="2" className='scrollable title'>Артикул Озон</th>
              {warehouses.map((warehouse) => {
                if (!hiddenWarehouses.includes(warehouse.warehouse_id)) {
                  return (
                    <React.Fragment key={warehouse.warehouse_id}>
                      <th colSpan="3" className='table__title'>
                        {warehouse.name.toUpperCase()}
                        <button className='table__title-button' onClick={() => hideWarehouses(warehouse.warehouse_id)}>&times;</button>
                      </th>
                    </React.Fragment>
                  );
                }
                return null;
              })}

            </tr>
            <tr>
              <th className='table__title'>Количество</th>
              <th className='table__title table__title-date'>Дата</th>
              {warehouses.map((warehouse) => {
                if (!hiddenWarehouses.includes(warehouse.warehouse_id)) {
                  return (
                    <React.Fragment key={warehouse.warehouse_id}>
                    <th className='table__title'>Доступно к заказу</th>
                    <th className='table__title'>Скорость продаж</th>
                    <th className='table__title'>На сколько дней хватит</th>
                  </React.Fragment>
                  );
                }
                return null;
              })}
              {/* {warehouses.map((warehouse) => (
                <React.Fragment key={warehouse.warehouse_id}>
                  <th className='table__title'>Доступно к заказу</th>
                  <th className='table__title'>Скорость продаж</th>
                </React.Fragment>
              ))} */}
            </tr>
          </thead>
          <tbody>
          {products.map((product) => {
            const hasValue = warehouses.some(warehouse => {
              const value = getGoodsForWarehouses(product, warehouse, goodsInWarehouses);
              return value !== "-";
            });
            if (hasValue) {
              return (
                <tr key={product.product_id}>
                  <td>{getMaxSales(product)}</td>
                  <td>{getMaxSalesDate(product)}</td>
                  <td>{getSalesSpeed(product)}</td>
                  <td className='table__product scrollable'>{product.offer_id}</td>
                  {warehouses.map((warehouse) => {
                if (!hiddenWarehouses.includes(warehouse.warehouse_id)) {
                  return (
                    <React.Fragment key={warehouse.warehouse_id}>
                      <td>
                        {getGoodsForWarehouses(product, warehouse, goodsInWarehouses)}
                      </td>
                      <td>
                        {getSalesSpeedForWarehouses(product, warehouse)}
                      </td>
                      <td>
                        {calculateRatio(product, warehouse)}
                      </td>
                    </React.Fragment>
                  );
                }
                return null;
              })}
                  {/* {warehouses.map((warehouse) => (
                    <React.Fragment key={warehouse.warehouse_id}>
                      <td>
                        {getGoodsForWarehouses(product, warehouse, goodsInWarehouses)}
                      </td>
                      <td>
                        {getSalesSpeedForWarehouses(product, warehouse)}
                      </td>
                    </React.Fragment>
                  ))} */}
                </tr>
              );
            }
              return null
          })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;