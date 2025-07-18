const axios = require('axios');
const cheerio = require('cheerio');

class WebScraper {
  constructor() {
    this.baseUrl = 'https://thecustomhub.com';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Extract price from text
  extractPrice(text) {
    const priceMatch = text.match(/\$[\d,]+\.?\d*/);
    return priceMatch ? priceMatch[0] : null;
  }

  // Search for products on the website
  async searchProducts(query) {
    try {
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const products = [];

      // Look for product cards
      $('.product-card, .product-item, [data-product]').each((i, element) => {
        const $el = $(element);
        const title = $el.find('.product-title, .product-name, h3, h4').first().text().trim();
        const price = $el.find('.price, .product-price, [data-price]').first().text().trim();
        const image = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
        const link = $el.find('a').first().attr('href');

        if (title && price) {
          products.push({
            title,
            price: this.extractPrice(price) || price,
            image: image ? (image.startsWith('http') ? image : `${this.baseUrl}${image}`) : null,
            link: link ? (link.startsWith('http') ? link : `${this.baseUrl}${link}`) : null
          });
        }
      });

      return products.slice(0, 5); // Return top 5 results
    } catch (error) {
      console.error('Error searching products:', error.message);
      return [];
    }
  }

  // Get product details from a specific product page
  async getProductDetails(productUrl) {
    try {
      const response = await axios.get(productUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      const title = $('.product-title, .product-name, h1').first().text().trim();
      const price = $('.price, .product-price, [data-price]').first().text().trim();
      const description = $('.product-description, .description, [data-description]').first().text().trim();
      const images = [];
      
      $('.product-image img, .gallery img').each((i, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src');
        if (src) {
          images.push(src.startsWith('http') ? src : `${this.baseUrl}${src}`);
        }
      });

      return {
        title,
        price: this.extractPrice(price) || price,
        description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
        images: images.slice(0, 3)
      };
    } catch (error) {
      console.error('Error getting product details:', error.message);
      return null;
    }
  }

  // Get collection/category information
  async getCollectionInfo(collectionName) {
    try {
      const collectionUrl = `${this.baseUrl}/collections/${collectionName.toLowerCase().replace(/\s+/g, '-')}`;
      const response = await axios.get(collectionUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const products = [];

      $('.product-card, .product-item, [data-product]').each((i, element) => {
        const $el = $(element);
        const title = $el.find('.product-title, .product-name, h3, h4').first().text().trim();
        const price = $el.find('.price, .product-price, [data-price]').first().text().trim();

        if (title && price) {
          products.push({
            title,
            price: this.extractPrice(price) || price
          });
        }
      });

      return {
        collection: collectionName,
        productCount: products.length,
        products: products.slice(0, 5),
        priceRange: products.length > 0 ? {
          min: Math.min(...products.map(p => parseFloat(p.price.replace(/[$,]/g, '')) || 0)),
          max: Math.max(...products.map(p => parseFloat(p.price.replace(/[$,]/g, '')) || 0))
        } : null
      };
    } catch (error) {
      console.error('Error getting collection info:', error.message);
      return null;
    }
  }

  // Check if a product exists and get basic info
  async checkProductAvailability(productName) {
    const cacheKey = `product_${productName.toLowerCase()}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const products = await this.searchProducts(productName);
      
      const result = {
        found: products.length > 0,
        products: products,
        searchTerm: productName
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Error checking product availability:', error.message);
      return { found: false, products: [], searchTerm: productName };
    }
  }

  // Get pricing information for common products
  async getPricingInfo(productType) {
    const commonProducts = {
      't-shirt': ['custom t-shirt', 'printed t-shirt'],
      'hoodie': ['custom hoodie', 'printed hoodie'],
      'mug': ['custom mug', 'personalized mug'],
      'sweatshirt': ['custom sweatshirt', 'printed sweatshirt']
    };

    const searchTerms = commonProducts[productType.toLowerCase()] || [productType];
    const allProducts = [];

    for (const term of searchTerms) {
      const products = await this.searchProducts(term);
      allProducts.push(...products);
    }

    // Remove duplicates and get price range
    const uniqueProducts = allProducts.filter((product, index, self) => 
      index === self.findIndex(p => p.title === product.title)
    );

    const prices = uniqueProducts
      .map(p => parseFloat(p.price.replace(/[$,]/g, '')) || 0)
      .filter(p => p > 0);

    return {
      productType,
      available: uniqueProducts.length > 0,
      productCount: uniqueProducts.length,
      priceRange: prices.length > 0 ? {
        min: Math.min(...prices),
        max: Math.max(...prices)
      } : null,
      sampleProducts: uniqueProducts.slice(0, 3)
    };
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

module.exports = WebScraper; 