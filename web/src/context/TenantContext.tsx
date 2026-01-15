import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

interface Tenant {
    id: number;
    name: string;
}

interface TenantContextType {
    selectedTenant: number; // 0 represents "All Tenants"
    setSelectedTenant: (id: number) => void;
    tenants: Tenant[];
    loading: boolean;
    refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedTenant, setSelectedTenantState] = useState<number>(() => {
        const saved = localStorage.getItem('selectedTenant');
        return saved !== null ? parseInt(saved, 10) : 0; // Default to All Tenants (0)
    });
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTenants = async () => {
        try {
            const res = await client.get('/admin/tenants');
            setTenants(res.data);
        } catch (err) {
            console.error("Failed to fetch tenants", err);
            setTenants([{ id: 1, name: 'Default Tenant' }]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const setSelectedTenant = (id: number) => {
        setSelectedTenantState(id);
        localStorage.setItem('selectedTenant', id.toString());
    };

    return (
        <TenantContext.Provider value={{ selectedTenant, setSelectedTenant, tenants, loading, refreshTenants: fetchTenants }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};
