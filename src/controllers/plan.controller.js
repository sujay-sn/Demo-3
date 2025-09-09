const status = require("http-status");
const { ifKeyExists, getETag } = require("../services/redis.service");
const config = require("../../config/local.json");
const { isValidJSONSchema } = require("../services/jsonSchema.service");

const PLAN_SCHEMA = require("../models/plan.model");
const {
	createSavePlan,
	getSavedPlan,
	deleteSavedPlan,
	generateETag,
} = require("../services/plan.service");
const rabbit = require("../services/rabbitmq.service");

const getPlan = async (req, res) => {
	console.log("Executing the GET method.");
	try {
		const { objectId } = req.params;

		// create key in the format - <type>_<objectId>
		const KEY = `${config.PLAN_TYPE}_${objectId}`;

		// Check if the KEY is present in the database(redis)
		const isKeyValid = await ifKeyExists(KEY);
		console.log(`Key to deal with: ${KEY}`);

		// check for valid objectId
		if (!isKeyValid) {
			console.log(`${KEY}: not valid!`);
			return res.status(status.NOT_FOUND).send({
				message: `Invalid ObjectId! - ${objectId}`,
				value: objectId,
				type: "Invalid",
			});
		}

		const eTag = await getETag(KEY);
		const urlETag = req.headers["if-none-match"];

		// Normalize the incoming ETag by removing quotes, if they exist
		const normalizedUrlETag = urlETag
			? urlETag.replace(/"/g, "")
			: null;

		if (normalizedUrlETag === eTag) {
			console.log(
				`ETag match found: ${eTag}. Returning 304 Not Modified.`
			);
			res.setHeader("ETag", `"${eTag}"`);
			return res.status(status.NOT_MODIFIED).send();
		}
		console.log("Saving Plan...");
		const plan = await getSavedPlan(KEY);
		console.log("Saved successfully!!");
		res.setHeader("ETag", eTag);
		return res.status(status.OK).send(plan);
	} catch (error) {
		return res.status(status.UNAUTHORIZED).send({
			message: "Something went wrong!!",
		});
	}
};

const createPlan = async (req, res) => {
	console.log("Executing the POST method.");
	try {
		const planJSON = req.body;
		if (!!!planJSON) {
			return res.status(status.BAD_REQUEST).send({
				message: "Invalid body!",
				type: "Invalid",
			});
		}

		console.log("Validating JSON body");
		const isValidSchema = await isValidJSONSchema(
			planJSON,
			PLAN_SCHEMA
		);

		if (isValidSchema?.error) {
			console.log("Invalid JSON");
			return res.status(status.BAD_REQUEST).send({
				message: "Invalid Schema!",
				type: "Invalid",
				...isValidSchema?.data,
			});
		}

		console.log("Valid JSON");
		const KEY = `${config.PLAN_TYPE}_${planJSON.objectId}`;

		console.log(`Checking for ${KEY} validation!`);
		const isKeyValid = await ifKeyExists(KEY);
		if (isKeyValid) {
			console.log(`${KEY}: not valid!`);
			return res.status(status.CONFLICT).send({
				message: `Plan already exist! - ${planJSON.objectId}`,
				type: "Already Exists",
			});
		}
		console.log("Creating plan..");
		await createSavePlan(KEY, planJSON);
		const eTag = generateETag(KEY, planJSON);

		console.log("sending message to queue....");
		// Send Message to Queue for Indexing
		const message = {
			operation: "STORE",
			body: planJSON,
		};
		rabbit.producer(message);

		console.log(`${planJSON.objectId}: Plan created successfully!`);

		res.setHeader("ETag", eTag);

		return res.status(status.OK).send({
			message: "Plan created successfully",
			objectId: planJSON.objectId,
		});
	} catch (error) {
		return res.status(status.UNAUTHORIZED).send({
			message: "Something went wrong!!",
		});
	}
};

const deletePlan = async (req, res) => {
	try {
		const { objectId } = req.params;
		console.log("Executing the DELETE method.");

		// create key in the format - <type>_<objectId>
		const KEY = `${config.PLAN_TYPE}_${objectId}`;

		console.log(`Key to deal with: ${KEY}`);

		// Check if the KEY is present in the database(redis)
		const isKeyValid = await ifKeyExists(KEY);

		// check for valid objectId
		if (!isKeyValid) {
			console.log(`${KEY}: not valid!`);
			return res.status(status.NOT_FOUND).send({
				message: `Invalid ObjectId! - ${objectId}`,
				value: objectId,
				type: "Invalid",
			});
		}
		console.log("Get ETag and check for If-Match");
		const urlETag = req.headers["if-match"];
		if (!urlETag) {
			return res.status(status.BAD_REQUEST).send({
				message: "Etag not provided in if-match header!",
			});
		}

		const eTag = await getETag(KEY);

		// Normalize the incoming ETag by removing quotes, if they exist
		const normalizedUrlETag = urlETag.replace(/"/g, "");

		if (normalizedUrlETag !== eTag) {
			console.log(
				`ETag mismatch. Request: ${normalizedUrlETag}, Server: ${eTag}. Returning 412.`
			);
			res.setHeader("ETag", `"${eTag}"`);
			return res.status(status.PRECONDITION_FAILED).send();
		}
		console.log("sending message to queue....");

		const oldPlan = await getSavedPlan(KEY);
		// Send Message to Queue for Indexing
		const message = {
			operation: "DELETE",
			body: oldPlan,
		};
		rabbit.producer(message);

		console.log("Deleting plan...");
		await deleteSavedPlan(KEY);
		console.log("Plan Deleted successfully!!");

		return res.status(status.OK).send({
			message: "Plan deleted successfully",
			objectId,
		});
	} catch (error) {
		return res.status(status.UNAUTHORIZED).send({
			message: "Something went wrong!!",
		});
	}
};

const putPlan = async (req, res) => {
	try {
		const { objectId } = req.params;
		const planJSON = req.body;

		console.log("Executing the PUT method.");

		// create key in the format - <type>_<objectId>
		const KEY = `${config.PLAN_TYPE}_${objectId}`;

		console.log(`Key to deal with: ${KEY}`);

		// Check if the KEY is present in the database(redis)
		const isKeyValid = await ifKeyExists(KEY);

		// check for valid objectId
		if (!isKeyValid) {
			console.log(`${KEY}: not valid!`);
			return res.status(status.NOT_FOUND).send({
				message: `Invalid ObjectId! - ${objectId}`,
				value: objectId,
				type: "Invalid",
			});
		}

		// If invalid body
		if (!!!planJSON) {
			return res.status(status.BAD_REQUEST).send({
				message: "Invalid body!",
				type: "Invalid",
			});
		}

		console.log("Validating JSON body");
		const isValidSchema = await isValidJSONSchema(
			planJSON,
			PLAN_SCHEMA
		);

		if (isValidSchema?.error) {
			console.log("Invalid JSON");
			return res.status(status.BAD_REQUEST).send({
				message: "Invalid Schema!",
				type: "Invalid",
				...isValidSchema?.data,
			});
		}

		console.log("Get ETag and check for If-Match");
		const urlETag = req.headers["if-match"];
		if (!urlETag) {
			return res.status(status.BAD_REQUEST).send({
				message: "Etag not provided in if-match header!",
			});
		}

		const eTag = await getETag(KEY);

		// Normalize the incoming ETag by removing quotes, if they exist
		const normalizedUrlETag = urlETag.replace(/"/g, "");

		if (normalizedUrlETag !== eTag) {
			console.log(
				`ETag mismatch. Request: ${normalizedUrlETag}, Server: ${eTag}. Returning 412.`
			);
			res.setHeader("ETag", `"${eTag}"`);
			return res.status(status.PRECONDITION_FAILED).send();
		}

		const oldPlan = await getSavedPlan(KEY);
		console.log("sending message to queue....");

		// Send Message to Queue for Indexing
		const message = {
			operation: "DELETE",
			body: oldPlan,
		};
		rabbit.producer(message);

		await deleteSavedPlan(KEY);

		console.log("Create new ETag");
		await createSavePlan(KEY, planJSON);
		const eTagNew = generateETag(KEY, planJSON);

		console.log("Saved successfully!!");
		console.log("Get Saved plan");
		const plan = await getSavedPlan(KEY);
		console.log(plan);
		// Send Message to Queue for Indexing
		const message1 = {
			operation: "STORE",
			body: plan,
		};
		rabbit.producer(message1);
		res.setHeader("ETag", `"${eTagNew}"`);
		console.log("////");
		return res.status(status.OK).send(plan);
	} catch (error) {
		console.log(JSON.stringify(error));
		return res.status(status.UNAUTHORIZED).send({
			message: "Something went wrong!!",
		});
	}
};

const patchPlan = async (req, res) => {
    try {
        const {
            objectId
        } = req.params;
        const patchData = req.body; // Renamed for clarity

        console.log("Executing the ADDITIVE PATCH method.")

        const KEY = `${config.PLAN_TYPE}_${objectId}`;
        console.log(`Key to deal with: ${KEY}`);

        const isKeyValid = await ifKeyExists(KEY);
        if (!isKeyValid) {
            console.log(`${KEY}: not valid!`)
            return res.status(status.NOT_FOUND).send({
                message: `Invalid ObjectId! - ${objectId}`
            });
        }

        // --- ETag Validation (Robust Version) ---
        const urlETag = req.headers['if-match'];
        if (!urlETag) {
            return res.status(status.BAD_REQUEST).send({
                message: "Etag not provided in if-match header!"
            });
        }
        const eTag = await getETag(KEY);
        const normalizedUrlETag = urlETag.replace(/"/g, '');
        if (normalizedUrlETag !== eTag) {
            console.log(`ETag mismatch. Request: ${normalizedUrlETag}, Server: ${eTag}. Returning 412.`);
            res.setHeader('ETag', `"${eTag}"`);
            return res.status(status.PRECONDITION_FAILED).send();
        }
        // --- End of ETag Validation ---

        // 1. GET THE CURRENT STATE OF THE PLAN
        console.log("Fetching current plan from Redis...");
        const currentPlan = await getSavedPlan(KEY);

        // 2. INTELLIGENTLY MERGE THE PATCH DATA
        console.log("Merging new patch data with current plan...");
        // Start with a copy of the current plan
        const mergedPlan = { ...currentPlan };
        // Overwrite top-level simple properties
        Object.assign(mergedPlan, patchData);
        // Specifically handle the linkedPlanServices array: CONCATENATE them
        if (patchData.linkedPlanServices && Array.isArray(patchData.linkedPlanServices)) {
            mergedPlan.linkedPlanServices = (currentPlan.linkedPlanServices || []).concat(patchData.linkedPlanServices);
        }

        // 3. WIPE THE OLD STATE
        console.log("Wiping old plan from Redis and scheduling deletion from Elasticsearch...");
        // Schedule deletion of the old document in Elasticsearch
        rabbit.producer({
            operation: "DELETE",
            body: currentPlan
        });
        // Delete all old keys from Redis
        await deleteSavedPlan(KEY);

        // 4. SAVE THE NEW, MERGED STATE
        console.log("Saving merged plan to Redis and scheduling indexing in Elasticsearch...");
        // Save the complete merged object back to Redis
        await createSavePlan(KEY, mergedPlan);
        const eTagNew = generateETag(KEY, mergedPlan); // Generate ETag from the full merged object

        // Schedule indexing of the new, complete document
        rabbit.producer({
            operation: "STORE",
            body: mergedPlan
        });

        res.setHeader('ETag', `"${eTagNew}"`);
        return res.status(status.OK).send(mergedPlan);

    } catch (error) {
        console.log(error)
        return res.status(status.BAD_REQUEST).send({
            message: error.message
        });
    }
}
module.exports = {
	getPlan,
	createPlan,
	deletePlan,
	putPlan,
	patchPlan,
};
