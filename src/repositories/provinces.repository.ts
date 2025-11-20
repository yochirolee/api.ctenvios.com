import { Province, City, Prisma } from "@prisma/client";
import prisma from "../lib/prisma.client";

type CityWithProvince = Prisma.CityGetPayload<{
   include: { province: true };
}>;

const provinces = {
   get: async (): Promise<Province[]> => {
      // Ensure valid numeric values
      const provinces = await prisma.province.findMany({
         include: {
            cities: true,
         },
         orderBy: {
            id: "asc",
         },
      });
      return provinces;
   },

   getCityById: async (city_id: number): Promise<CityWithProvince | null> => {
      const city = await prisma.city.findUnique({
         where: { id: city_id },
         include: {
            province: true,
         },
      });
      return city;
   },

   getCityByName: async (city_name: string, province_id?: number): Promise<CityWithProvince | null> => {
      const city = await prisma.city.findFirst({
         where: {
            name: {
               equals: city_name,
               mode: "insensitive",
            },
            ...(province_id && { province_id }),
         },
         include: {
            province: true,
         },
      });
      return city;
   },
};

export default provinces;
