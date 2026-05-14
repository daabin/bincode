"use strict";
/**
 * Web service abstraction
 * Provides web search and content fetching capabilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultWebService = void 0;
class DefaultWebService {
    searchEndpoint = 'https://api.duckduckgo.com';
    async search(query, limit = 5) {
        // Use DuckDuckGo instant answer API
        try {
            const response = await fetch(`${this.searchEndpoint}/?q=${encodeURIComponent(query)}&format=json&no_html=1`, { headers: { 'User-Agent': 'bincode/0.2.0' } });
            if (!response.ok) {
                throw new Error(`Search request failed: ${response.status}`);
            }
            const data = await response.json();
            const results = [];
            if (data.AbstractText) {
                results.push({
                    title: query,
                    url: data.AbstractURL || '',
                    snippet: data.AbstractText
                });
            }
            if (data.RelatedTopics) {
                for (const topic of data.RelatedTopics) {
                    if (results.length >= limit)
                        break;
                    if (topic.Text && topic.FirstURL) {
                        results.push({
                            title: topic.Text.split(' - ')[0] || topic.Text,
                            url: topic.FirstURL,
                            snippet: topic.Text
                        });
                    }
                }
            }
            return results;
        }
        catch (error) {
            throw new Error(`Web search failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async fetch(url, selector) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; bincode/0.2.0)',
                    'Accept': 'text/html,text/plain,*/*'
                }
            });
            if (!response.ok) {
                throw new Error(`Fetch failed: ${response.status}`);
            }
            const text = await response.text();
            // If no selector, return plain text (strip HTML tags)
            if (!selector) {
                return text
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 10000);
            }
            // Simple selector-based extraction
            if (selector.startsWith('#')) {
                const id = selector.substring(1);
                const match = text.match(new RegExp(`<[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'));
                return match ? match[1].replace(/<[^>]+>/g, '').trim() : `Element #${id} not found`;
            }
            if (selector.startsWith('.')) {
                const cls = selector.substring(1);
                const match = text.match(new RegExp(`<[^>]*class=["'][^"']*${cls}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'));
                return match ? match[1].replace(/<[^>]+>/g, '').trim() : `Element .${cls} not found`;
            }
            return text.substring(0, 10000);
        }
        catch (error) {
            throw new Error(`Web fetch failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
exports.DefaultWebService = DefaultWebService;
