import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {CallableRequest} from "firebase-functions/v2/https";


admin.initializeApp();
const db = admin.firestore();

// Helper to check authentication
const isAuthenticated = (context: functions.https.CallableRequest): boolean => {
  return !!context.auth?.uid;
};

// Create a new Todo
export const createTodo = functions.https.onCall(async (request: CallableRequest<any>): Promise<any> => {
  if (!isAuthenticated(request)) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const {task} = request.data;
  if (!task || typeof task !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Task is required and must be a string.");
  }

  if (request.auth) {
    const newTodo = {
      user_id: request.auth.uid,
      task,
      completed: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      completed_at: null,
    };

    const docRef = await db.collection("todos").add(newTodo);
    return {id: docRef.id, ...newTodo};
  }
});

// Get all Todos for the authenticated user
export const getTodos = functions.https.onCall(async (request: CallableRequest<any>): Promise<any> => {
  if (!isAuthenticated(request)) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }
  if (request.auth) {
    const snapshot = await db.collection("todos")
      .where("user_id", "==", request.auth.uid)
      .orderBy("created_at", "desc")
      .get();

    const todos: any[] = [];
    snapshot.forEach((doc) => {
      todos.push({id: doc.id, ...doc.data()});
    });

    return {todos};
  }
});

// Update a Todo
export const updateTodo = functions.https.onCall(async (request: CallableRequest<any>): Promise<any> => {
  if (!isAuthenticated(request)) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const {id, task, completed} = request.data;
  if (!id || typeof id !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Todo ID is required and must be a string.");
  }

  const todoRef = db.collection("todos").doc(id);
  const todoDoc = await todoRef.get();

  if (!todoDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Todo not found.");
  }

  if (request.auth) {
    if (todoDoc.data()?.user_id !== request.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "Cannot update others' Todos.");
    }
  }

  const updatedFields: any = {};
  if (task && typeof task === "string") {
    updatedFields.task = task;
  }
  if (typeof completed === "boolean") {
    updatedFields.completed = completed;
    updatedFields.completed_at = completed ? admin.firestore.FieldValue.serverTimestamp() : null;
  }

  await todoRef.update(updatedFields);
  const updatedTodo = await todoRef.get();

  return {id: updatedTodo.id, ...updatedTodo.data()};
});

// Delete a Todo
export const deleteTodo = functions.https.onCall(async (request: CallableRequest<any>): Promise<any> => {
  if (!isAuthenticated(request)) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const {id} = request.data;
  if (!id || typeof id !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Todo ID is required and must be a string.");
  }

  const todoRef = db.collection("todos").doc(id);
  const todoDoc = await todoRef.get();

  if (!todoDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Todo not found.");
  }

  if (request.auth) {
    if (todoDoc.data()?.user_id !== request.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "Cannot delete others' Todos.");
    }
  }

  await todoRef.delete();
  return {message: "Todo deleted successfully."};
});
