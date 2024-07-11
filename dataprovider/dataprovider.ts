import { DataProvider } from "@refinedev/core";
import {
    Firestore,
    getDocs,
    collection,
    addDoc,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    where,
    query,
    orderBy,
    getFirestore,
} from "firebase/firestore";
import { db } from "../firebase/firebaseconfig";

class FirestoreDatabase {
    database: Firestore;

    constructor(options?: any, database?: Firestore) {
        this.database = database || getFirestore(options?.firebaseApp);
    }

    getCollectionRef(resource: string) {
        return collection(this.database, resource);
    }

    getDocRef(resource: string, id: string) {
        return doc(this.database, resource, id);
    }

    getFilterQuery({ resource, sort, filters }: any) {
        const ref = this.getCollectionRef(resource);
        const filterQueries = filters?.map((filter: any) =>
            where(filter.field, getFilterOperator(filter.operator), filter.value)
        ) || [];
        const sortQueries = sort?.map((sorter: any) =>
            orderBy(sorter.field, sorter.order)
        ) || [];

        return query(ref, ...filterQueries, ...sortQueries);
    }

    async createData(args: any): Promise<any> {
        try {
            const ref = this.getCollectionRef(args.resource);
            const docRef = await addDoc(ref, args.variables);
            return { data: { id: docRef.id, ...args.variables } };
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async createManyData(args: any): Promise<any> {
        return this.createData(args);
    }

    async deleteData(args: any): Promise<void> {
        try {
            const ref = this.getDocRef(args.resource, args.id);
            await deleteDoc(ref);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async deleteManyData(args: any): Promise<void> {
        try {
            await Promise.all(args.ids.map((id: string) =>
                this.deleteData({ resource: args.resource, id })
            ));
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async getList(args: any): Promise<any> {
        try {
            const ref = this.getFilterQuery(args);
            const querySnapshot = await getDocs(ref);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return { data };
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async getMany(args: any): Promise<any> {
        try {
            const ref = this.getCollectionRef(args.resource);
            const querySnapshot = await getDocs(ref);
            const data = querySnapshot.docs
                .filter(doc => args.ids.includes(doc.id))
                .map(doc => ({ id: doc.id, ...doc.data() }));
            return { data };
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async getOne(args: any): Promise<any> {
        try {
            const docRef = this.getDocRef(args.resource, args.id);
            const docSnap = await getDoc(docRef);
            return { data: { ...docSnap.data(), id: docSnap.id } };
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async updateData(args: any): Promise<any> {
        try {
            const ref = this.getDocRef(args.resource, args.id);
            await updateDoc(ref, args.variables);
            return { data: args.variables };
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async updateManyData(args: any): Promise<void> {
        try {
            await Promise.all(args.ids.map((id: string) =>
                this.updateData({ resource: args.resource, id, variables: args.variables })
            ));
        } catch (error) {
            return Promise.reject(error);
        }
    }
}

const firestoreDatabase = new FirestoreDatabase({}, db);

const dataprovider: DataProvider = {
    getList: async ({ resource, pagination, sorters, filters, meta }) => {
        return firestoreDatabase.getList({ resource, pagination, sort: sorters, filters });
    },
    create: async ({ resource, variables, meta }) => {
        return firestoreDatabase.createData({ resource, variables });
    },
    update: async ({ resource, id, variables, meta }) => {
        return firestoreDatabase.updateData({ resource, id, variables });
    },
    deleteOne: async ({ resource, id, variables, meta }) => {
        return firestoreDatabase.deleteData({ resource, id });
    },
    getOne: async ({ resource, id, meta }) => {
        return firestoreDatabase.getOne({ resource, id });
    },
    getApiUrl: () => "",
    getMany: async ({ resource, ids, meta }) => {
        return firestoreDatabase.getMany({ resource, ids });
    },
    createMany: async ({ resource, variables, meta }) => {
        return firestoreDatabase.createManyData({ resource, variables });
    },
    deleteMany: async ({ resource, ids, variables, meta }) => {
        return firestoreDatabase.deleteManyData({ resource, ids });
    },
    updateMany: async ({ resource, ids, variables, meta }) => {
        return firestoreDatabase.updateManyData({ resource, ids, variables });
    },
};

function getFilterOperator(operator: string) {
    const operators: { [key: string]: string } = {
        lt: "<",
        lte: "<=",
        gt: ">",
        gte: ">=",
        eq: "==",
        ne: "!=",
        nin: "not-in",
        in: "in",
    };
    return operators[operator] || "in";
}

export default dataprovider;

