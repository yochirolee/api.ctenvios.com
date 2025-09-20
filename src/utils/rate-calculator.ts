import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface RateCalculationInput {
	productId?: number;
	weight: number;
	quantity: number;
	agencyId: number;
	serviceId: number;
	isVirtualProduct?: boolean;
}

export interface RateCalculationResult {
	baseRateInCents: number;
	shippingRateInCents: number;
	totalRateInCents: number;
	rateId: number;
	calculationType: "PHYSICAL_PRODUCT" | "VIRTUAL_PRODUCT" | "WEIGHT_BASED";
}

/**
 * Calcula el rate total para un item basado en el tipo de producto
 * Siguiendo las reglas del proyecto: TypeScript strict typing, Repository pattern
 */
export async function calculateItemRate(
	input: RateCalculationInput,
): Promise<RateCalculationResult> {
	const { productId, weight, quantity, agencyId, serviceId, isVirtualProduct } = input;

	// Si es un producto específico, obtener sus datos
	if (productId) {
		const product = await prisma.product.findUnique({
			where: { id: productId },
			include: {
				shipping_rates: {
					where: {
						agency_id: agencyId,
						service_id: serviceId,
						is_active: true,
					},
				},
			},
		});

		if (!product) {
			throw new Error(`Product with ID ${productId} not found`);
		}

		// Producto virtual con rate fijo por agencia/servicio
		if (product.is_virtual || isVirtualProduct) {
			return calculateVirtualProductRate(product, quantity, agencyId, serviceId);
		}

		// Producto físico: precio del producto + shipping rate
		return calculatePhysicalProductRate(product, weight, quantity, agencyId, serviceId);
	}

	// Sin producto específico - usar rate base por peso
	return calculateWeightBasedRate(weight, quantity, agencyId, serviceId);
}

/**
 * Calcula rate para productos virtuales (rate fijo por agencia/servicio)
 */
async function calculateVirtualProductRate(
	product: any,
	quantity: number,
	agencyId: number,
	serviceId: number,
): Promise<RateCalculationResult> {
	// Buscar rate específico para este producto virtual
	const specificRate = product.shipping_rates.find((rate: any) => rate.rate_type === "FIXED");

	if (specificRate) {
		const totalRate = specificRate.rate_in_cents * quantity;
		return {
			baseRateInCents: 0,
			shippingRateInCents: totalRate,
			totalRateInCents: totalRate,
			rateId: specificRate.id,
			calculationType: "VIRTUAL_PRODUCT",
		};
	}

	// Si no hay rate específico, usar el precio base del producto
	if (product.sale_in_cents > 0) {
		const totalRate = product.sale_in_cents * quantity;

		// Buscar un rate genérico para el servicio
		const genericRate = await findGenericServiceRate(agencyId, serviceId);

		return {
			baseRateInCents: totalRate,
			shippingRateInCents: 0,
			totalRateInCents: totalRate,
			rateId: genericRate?.id || 0,
			calculationType: "VIRTUAL_PRODUCT",
		};
	}

	throw new Error(`No rate configuration found for virtual product ${product.id}`);
}

/**
 * Calcula rate para productos físicos (precio producto + shipping por peso)
 */
async function calculatePhysicalProductRate(
	product: any,
	weight: number,
	quantity: number,
	agencyId: number,
	serviceId: number,
): Promise<RateCalculationResult> {
	const baseProductCost = product.sale_in_cents * quantity;

	// Obtener rate de shipping por peso
	const shippingRate = await findWeightBasedRate(weight, agencyId, serviceId);

	if (!shippingRate) {
		throw new Error(`No shipping rate found for weight ${weight} lbs`);
	}

	const shippingCost = Math.ceil(weight * shippingRate.rate_in_cents);

	return {
		baseRateInCents: baseProductCost,
		shippingRateInCents: shippingCost,
		totalRateInCents: baseProductCost + shippingCost,
		rateId: shippingRate.id,
		calculationType: "PHYSICAL_PRODUCT",
	};
}

/**
 * Calcula rate basado solo en peso (sin producto específico)
 */
async function calculateWeightBasedRate(
	weight: number,
	quantity: number,
	agencyId: number,
	serviceId: number,
): Promise<RateCalculationResult> {
	const shippingRate = await findWeightBasedRate(weight, agencyId, serviceId);

	if (!shippingRate) {
		throw new Error(`No shipping rate found for weight ${weight} lbs`);
	}

	const totalCost = Math.ceil(weight * shippingRate.rate_in_cents * quantity);

	return {
		baseRateInCents: 0,
		shippingRateInCents: totalCost,
		totalRateInCents: totalCost,
		rateId: shippingRate.id,
		calculationType: "WEIGHT_BASED",
	};
}

/**
 * Busca rate de shipping basado en peso
 */
async function findWeightBasedRate(
	weight: number,
	agencyId: number,
	serviceId: number,
): Promise<any> {
	return await prisma.shippingRate.findFirst({
		where: {
			agency_id: agencyId,
			service_id: serviceId,
			rate_type: "WEIGHT",
			is_active: true,
			OR: [
				{
					AND: [{ min_weight: { lte: weight } }, { max_weight: { gte: weight } }],
				},
				{
					AND: [{ min_weight: null }, { max_weight: null }],
				},
			],
		},
		orderBy: [{ is_base_rate: "desc" }, { created_at: "desc" }],
	});
}

/**
 * Busca rate genérico para un servicio
 */
async function findGenericServiceRate(agencyId: number, serviceId: number): Promise<any> {
	return await prisma.shippingRate.findFirst({
		where: {
			agency_id: agencyId,
			service_id: serviceId,
			is_active: true,
			productId: null, // Rate genérico, no específico de producto
		},
		orderBy: [{ is_base_rate: "desc" }, { created_at: "desc" }],
	});
}

/**
 * Obtiene todos los productos virtuales con sus rates por agencia/servicio
 */
export async function getVirtualProductsWithRates(
	agencyId: number,
	serviceId?: number,
): Promise<any[]> {
	return await prisma.product.findMany({
		where: {
			agency_id: agencyId,
			is_virtual: true,
			is_active: true,
		},
		include: {
			shipping_rates: {
				where: {
					...(serviceId && { service_id: serviceId }),
					is_active: true,
				},
				include: {
					service: {
						select: {
							id: true,
							name: true,
							service_type: true,
						},
					},
				},
			},
		},
	});
}

/**
 * Crea o actualiza rate para cualquier producto (físico o virtual)
 * GARANTIZA: Solo un rate por producto + agencia + servicio
 */
export async function setProductRate(
	productId: number,
	agencyId: number,
	serviceId: number,
	rateInCents: number,
	costInCents?: number,
	rateType: "FIXED" | "WEIGHT" = "FIXED",
): Promise<any> {
	try {
		// Usar upsert para garantizar unicidad
		const rate = await prisma.shippingRate.upsert({
			where: {
				// Usar el constraint único que definimos
				unique_product_agency_service_rate: {
					productId,
					agency_id: agencyId,
					service_id: serviceId,
				},
			},
			update: {
				// Si existe, actualizar
				rate_in_cents: rateInCents,
				cost_in_cents: costInCents || 0,
				rate_type: rateType,
				is_active: true,
				updated_at: new Date(),
			},
			create: {
				// Si no existe, crear nuevo
				productId,
				agency_id: agencyId,
				service_id: serviceId,
				rate_in_cents: rateInCents,
				cost_in_cents: costInCents || 0,
				rate_type: rateType,
				name: `Rate for product ${productId}`,
				is_active: true,
			},
			include: {
				product: {
					select: {
						id: true,
						name: true,
						is_virtual: true,
					},
				},
				service: {
					select: {
						id: true,
						name: true,
						service_type: true,
					},
				},
			},
		});

		return rate;
	} catch (error) {
		throw new Error(
			`Error setting product rate: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * @deprecated Use setProductRate instead
 * Mantener por compatibilidad
 */
export async function setVirtualProductRate(
	productId: number,
	agencyId: number,
	serviceId: number,
	rateInCents: number,
	costInCents?: number,
): Promise<any> {
	return setProductRate(productId, agencyId, serviceId, rateInCents, costInCents, "FIXED");
}
