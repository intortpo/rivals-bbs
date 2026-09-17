import * as pc from 'playcanvas';

/**
 * Utility class to load and cache PlayCanvas GLB Container assets.
 * Container assets contain the 3D entity hierarchy, mesh instances, materials,
 * skeletons, and animation assets.
 */
export class PCGLBLoader {
  private app: pc.Application;
  private cache: Map<string, pc.ContainerResource> = new Map();
  private loadingPromises: Map<string, Promise<pc.ContainerResource>> = new Map();

  constructor(app: pc.Application) {
    this.app = app;
  }

  /**
   * Load a GLB container from a URL or return cached resource.
   */
  public async load(url: string): Promise<pc.ContainerResource> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    const promise = new Promise<pc.ContainerResource>((resolve, reject) => {
      this.app.assets.loadFromUrl(url, 'container', (err, asset) => {
        this.loadingPromises.delete(url);
        if (err || !asset || !asset.resource) {
          reject(new Error(`Failed to load GLB container from ${url}: ${err}`));
          return;
        }
        const resource = asset.resource as pc.ContainerResource;
        this.cache.set(url, resource);
        resolve(resource);
      });
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  /**
   * Preload a list of GLB containers in parallel.
   */
  public async preloadAll(urls: string[], onProgress?: (completed: number, total: number) => void): Promise<void> {
    let completed = 0;
    const total = urls.length;
    await Promise.all(
      urls.map(async (url) => {
        try {
          await this.load(url);
        } catch (e) {
          console.warn(`[PCGLBLoader] Preload failed for ${url}:`, e);
        } finally {
          completed++;
          onProgress?.(completed, total);
        }
      })
    );
  }

  /**
   * Retrieve an already loaded container synchronously.
   */
  public get(url: string): pc.ContainerResource | undefined {
    return this.cache.get(url);
  }

  /**
   * Check if a container is cached.
   */
  public has(url: string): boolean {
    return this.cache.has(url);
  }
}
