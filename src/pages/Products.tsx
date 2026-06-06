import React from 'react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Search, Plus, Filter, MoreHorizontal } from 'lucide-react';
import styles from './Products.module.css';

const MOCK_PRODUCTS = [
  { id: '1', name: 'Pastel Dream', category: 'Bouquet', price: 85, stock: 12, status: 'Active' },
  { id: '2', name: 'White Elegance', category: 'Arrangement', price: 120, stock: 5, status: 'Active' },
  { id: '3', name: 'Ruby Roses', category: 'Bouquet', price: 95, stock: 0, status: 'Out of Stock' },
  { id: '4', name: 'Sunflower Joy', category: 'Bouquet', price: 65, stock: 8, status: 'Active' },
];

export const Products: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Products</h1>
          <p className={styles.subtitle}>Manage your floral catalog, pricing, and availability.</p>
        </div>
        <Button className={styles.addBtn}>
          <Plus className={styles.btnIcon} />
          Add Product
        </Button>
      </div>

      <Card>
        <CardHeader className={styles.tableHeader}>
          <div className={styles.searchBar}>
            <Search className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search products..." 
              className={styles.searchInput}
            />
          </div>
          <Button variant="outline" className={styles.filterBtn}>
            <Filter className={styles.btnIcon} />
            Filters
          </Button>
        </CardHeader>
        <CardContent className={styles.tableContent}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PRODUCTS.map((product) => (
                <tr key={product.id}>
                  <td className={styles.productNameCell}>
                    <div className={styles.productImageSm}>🌸</div>
                    {product.name}
                  </td>
                  <td>{product.category}</td>
                  <td>${product.price.toFixed(2)}</td>
                  <td>
                    <span className={product.stock === 0 ? styles.outOfStock : ''}>
                      {product.stock}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${product.status === 'Active' ? styles.statusActive : styles.statusInactive}`}>
                      {product.status}
                    </span>
                  </td>
                  <td>
                    <button className={styles.actionBtn}>
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
